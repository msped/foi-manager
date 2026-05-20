from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from apps.users.models import Notification
from .models import Case, CaseConsultation, ConsultationMessage
from .permissions import IsFOITeam
from .serializers import CaseConsultationSerializer, ConsultationMessageSerializer
from .tasks import task_send_consultation_notification, task_send_consultation_message_notification


class CaseConsultationViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CaseConsultationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete']

    def _get_case(self):
        return get_object_or_404(Case, pk=self.kwargs['case_pk'])

    def get_queryset(self):
        return CaseConsultation.objects.filter(
            case=self._get_case()
        ).select_related('assignee', 'mailbox', 'created_by').prefetch_related('messages__author')

    def perform_create(self, serializer):
        consultation = serializer.save(case=self._get_case(), created_by=self.request.user)
        if consultation.assignee:
            task_send_consultation_notification.delay(consultation.pk)

    def perform_update(self, serializer):
        consultation = serializer.save()
        if 'status' in serializer.validated_data:
            _notify_foi_team(consultation, f'Consultation on {consultation.case.ref} status changed to {consultation.get_status_display()}')

    def perform_destroy(self, instance):
        instance.status = CaseConsultation.Status.WITHDRAWN
        instance.save(update_fields=['status'])


class ConsultationMessageViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ConsultationMessageSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post']

    def _get_consultation(self):
        user = self.request.user
        qs = CaseConsultation.objects.select_related('case', 'assignee')
        if not user.is_foi_team():
            qs = qs.filter(assignee=user)
        return get_object_or_404(qs, pk=self.kwargs['consultation_pk'])

    def get_queryset(self):
        consultation = self._get_consultation()
        return ConsultationMessage.objects.filter(
            consultation=consultation
        ).select_related('author')

    def perform_create(self, serializer):
        consultation = self._get_consultation()
        message = serializer.save(consultation=consultation, author=self.request.user)

        if self.request.user.is_foi_team():
            task_send_consultation_message_notification.delay(message.pk)
        else:
            _notify_foi_team(
                consultation,
                f'New message on {consultation.case.ref} consultation from {self.request.user.get_full_name() or self.request.user.email}',
                link=f'/cases/{consultation.case_id}',
            )


def _notify_foi_team(consultation, message: str, link: str = ''):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    foi_users = User.objects.filter(role='foi_team', is_active=True)
    Notification.objects.bulk_create([
        Notification(user=u, message=message, link=link)
        for u in foi_users
    ])
