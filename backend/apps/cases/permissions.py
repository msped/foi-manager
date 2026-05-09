from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsFOITeam(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_foi_team()


class IsFOITeamOrAssignedAssignee(BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_foi_team():
            return True
        return obj.assignee == user
