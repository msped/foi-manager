"""Public endpoints for requesters checking the progress of their own requests.

All three are unauthenticated by design, and `authentication_classes` is emptied
on each so a stale staff JWT left in a browser can never turn one of these into
a 401. Access is granted by the signed session token minted in the verify view,
and by nothing else.

See `verification.py` for the access model and the invariants behind it.
"""

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .emails import build_context
from .serializers import (
    PublicTrackedCaseSerializer,
    RequesterCodeRequestSerializer,
    RequesterCodeVerifySerializer,
)
from .tasks import task_send_verification_code
from .verification import (
    SESSION_MAX_AGE_SECONDS,
    cases_for_email,
    issue_code,
    make_session_token,
    normalise_email,
    read_session_token,
    verify_code,
)

#: Where the portal puts the session token.
#:
#: Read explicitly here rather than attached by the public app's axios
#: singleton, which is documented as never sending credentials. This feature is
#: the first thing in the portal that has a credential to send, and that
#: boundary is worth keeping: the next person to add an endpoint should still
#: find that the default client carries nothing.
TRACK_TOKEN_HEADER = "HTTP_X_FOI_TRACK_TOKEN"


class RequestCodeView(APIView):
    """Issue a verification code to an email address.

    Answers identically in all three cases: code sent, address throttled, and
    address with no requests at all. That uniformity is the whole point of the
    endpoint. Any difference in message, status code or timing would let anyone
    test whether a named person has made an FOI request to this organisation,
    which for journalists, campaigners and complainants is often the fact most
    worth protecting.

    The send goes through Celery for the same reason: a synchronous send would
    make response time the tell, since an address with no cases would answer
    measurably faster than one that had to hand an email to an SMTP server.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    UNIFORM_RESPONSE = {
        "detail": (
            "If we have any requests from that email address, we have sent a "
            "code to it. The code expires in 15 minutes."
        )
    }

    def post(self, request):
        serializer = RequesterCodeRequestSerializer(data=request.data)
        # A malformed address is the one failure worth reporting: the person can
        # act on it, and it reveals nothing about anybody.
        serializer.is_valid(raise_exception=True)
        email = normalise_email(serializer.validated_data["email"])

        code = issue_code(email)
        if code is not None and cases_for_email(email).exists():
            task_send_verification_code.delay(email, build_context(code))

        return Response(self.UNIFORM_RESPONSE)


class VerifyCodeView(APIView):
    """Exchange a correct code for a signed session token."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = RequesterCodeVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]

        if not verify_code(email, code):
            # One message for every kind of failure: wrong code, expired code,
            # attempts exhausted, no code ever issued. Separating them would
            # tell someone guessing which addresses are worth persisting with,
            # and tells a genuine requester nothing they can use — the remedy is
            # the same every time, which is to ask for a new code.
            return Response(
                {
                    "detail": (
                        "That code is not correct, or it has expired. "
                        "Request a new code and try again."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "token": make_session_token(email),
                "expires_in": SESSION_MAX_AGE_SECONDS,
            }
        )


class TrackedCasesView(APIView):
    """List the cases belonging to a verified email address."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        token = request.META.get(TRACK_TOKEN_HEADER, "")
        email = read_session_token(token) if token else None
        if not email:
            return Response(
                {"detail": "Your session has ended. Check your requests again."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        return Response(
            {
                "email": email,
                "results": PublicTrackedCaseSerializer(
                    cases_for_email(email), many=True
                ).data,
            }
        )
