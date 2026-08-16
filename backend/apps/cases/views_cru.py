from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Case, CaseCRUAdvice
from .permissions import IsFOITeam
from .serializers import CaseCRUAdviceSerializer


class CaseCRUAdviceView(APIView):
    """Singleton CRU advice record hanging off a case.

    GET returns the stored record, or empty values when the case has never been
    referred — reading must not create a row. PUT upserts.
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsFOITeam()]

    def _get_case(self, case_pk):
        return get_object_or_404(Case, pk=case_pk)

    def get(self, request, case_pk):
        case = self._get_case(case_pk)
        advice = getattr(case, "cru_advice", None)
        if advice is None:
            return Response(
                {
                    "id": None,
                    "request_sent_at": None,
                    "received_at": None,
                    "advice": "",
                    "updated_at": None,
                }
            )
        return Response(CaseCRUAdviceSerializer(advice).data)

    def put(self, request, case_pk):
        case = self._get_case(case_pk)
        advice = getattr(case, "cru_advice", None)

        was_sent = bool(advice and advice.request_sent_at)
        was_received = bool(advice and advice.received_at)

        serializer = CaseCRUAdviceSerializer(advice, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if advice is None:
            advice = serializer.save(case=case)
        else:
            advice = serializer.save()

        if advice.request_sent_at and not was_sent:
            case._log(
                action="cru_request_sent",
                actor=request.user,
                detail={"request_sent_at": advice.request_sent_at.isoformat()},
            )
        if advice.received_at and not was_received:
            case._log(
                action="cru_advice_received",
                actor=request.user,
                detail={"received_at": advice.received_at.isoformat()},
            )

        return Response(CaseCRUAdviceSerializer(advice).data)

    def delete(self, request, case_pk):
        case = self._get_case(case_pk)
        CaseCRUAdvice.objects.filter(case=case).delete()
        return Response(status=204)
