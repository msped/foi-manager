from django.contrib import admin
from .models import Case, CaseAuditEvent, CaseNote, Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'internal_deadline_days']


class CaseNoteInline(admin.TabularInline):
    model = CaseNote
    extra = 0
    readonly_fields = ['author', 'created_at']


class AuditEventInline(admin.TabularInline):
    model = CaseAuditEvent
    extra = 0
    readonly_fields = ['actor', 'action', 'detail', 'timestamp']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = ['ref', 'status', 'requester_name', 'department', 'statutory_deadline', 'is_overdue']
    list_filter = ['status', 'department', 'received_by']
    search_fields = ['ref', 'requester_name', 'requester_email', 'request_text']
    readonly_fields = ['ref', 'acknowledged_at', 'statutory_deadline', 'created_at', 'updated_at']
    inlines = [CaseNoteInline, AuditEventInline]
