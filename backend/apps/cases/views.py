from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from .models import BankHoliday, Case, Department, RequesterCategory
from .permissions import IsFOITeam
from .serializers import (
    BankHolidaySerializer,
    CaseDetailSerializer,
    CaseListSerializer,
    CaseTransitionSerializer,
    DepartmentSerializer,
    PublicCaseSubmitSerializer,
    PublicCaseTrackSerializer,
    RequesterCategorySerializer,
)


class PublicCaseSubmitView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PublicCaseSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        case = serializer.save(received_by=Case.ReceivedBy.PORTAL)
        return Response({'ref': case.ref, 'status': case.status}, status=status.HTTP_201_CREATED)


class PublicCaseTrackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        ref = request.query_params.get('ref', '')
        email = request.query_params.get('email', '')
        case = get_object_or_404(Case, ref=ref, requester_email__iexact=email)
        serializer = PublicCaseTrackSerializer(case)
        return Response(serializer.data)


class CaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CaseDetailSerializer

    def get_queryset(self):
        qs = Case.objects.select_related('created_by')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return CaseListSerializer
        return CaseDetailSerializer

    def get_object(self):
        obj = get_object_or_404(self.get_queryset(), pk=self.kwargs['pk'])
        self.check_object_permissions(self.request, obj)
        return obj

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsFOITeam])
    def acknowledge(self, request, pk=None):
        case = get_object_or_404(Case, pk=pk)
        case.acknowledge(actor=request.user)
        return Response(CaseDetailSerializer(case).data)

    @action(detail=True, methods=['post'], permission_classes=[IsFOITeam])
    def transition(self, request, pk=None):
        case = get_object_or_404(Case, pk=pk)
        serializer = CaseTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        case.transition_to(serializer.validated_data['status'], actor=request.user)
        return Response(CaseDetailSerializer(case).data)

    @action(detail=True, methods=['post'], permission_classes=[IsFOITeam])
    def pause_clock(self, request, pk=None):
        case = get_object_or_404(Case, pk=pk)
        case.pause_clock(reason=request.data.get('reason', ''), actor=request.user)
        return Response(CaseDetailSerializer(case).data)

    @action(detail=True, methods=['post'], permission_classes=[IsFOITeam])
    def resume_clock(self, request, pk=None):
        case = get_object_or_404(Case, pk=pk)
        case.resume_clock(actor=request.user)
        return Response(CaseDetailSerializer(case).data)


class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None


class RequesterCategoryViewSet(viewsets.ModelViewSet):
    queryset = RequesterCategory.objects.all()
    serializer_class = RequesterCategorySerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsFOITeam()]


class BankHolidayViewSet(viewsets.ModelViewSet):
    serializer_class = BankHolidaySerializer
    permission_classes = [IsAuthenticated, IsFOITeam]
    pagination_class = None

    def get_queryset(self):
        qs = BankHoliday.objects.all()
        country = self.request.query_params.get('country')
        if country:
            qs = qs.filter(country=country)
        year = self.request.query_params.get('year')
        if year:
            qs = qs.filter(date__year=year)
        return qs
