from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.cases.permissions import IsFOITeam
from .models import PublicationSchemeEntry
from .serializers import PublicationSchemeEntrySerializer


class PublicationSchemeEntryViewSet(viewsets.ModelViewSet):
    serializer_class = PublicationSchemeEntrySerializer

    def get_queryset(self):
        qs = PublicationSchemeEntry.objects.all()
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated(), IsFOITeam()]
