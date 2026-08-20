from django.contrib import admin

from .models import RequesterVerification, RequesterVerificationCode


@admin.register(RequesterVerificationCode)
class RequesterVerificationCodeAdmin(admin.ModelAdmin):
    """Read-only. Rows here are a live security control and a throttle ledger,
    so editing one by hand either hands somebody a working code or resets an
    attempt counter that is deliberately hard to reset."""

    list_display = ["email", "attempts", "expires_at", "consumed_at", "created_at"]
    search_fields = ["email"]
    # The code itself is not listed: an admin screen is a shoulder-surfable
    # place to display a live one-time secret, and nobody has a reason to read
    # it out of the database.
    readonly_fields = ["email", "attempts", "expires_at", "consumed_at", "created_at"]
    exclude = ["code"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(RequesterVerification)
class RequesterVerificationAdmin(admin.ModelAdmin):
    """The access audit trail — visible so it can answer an ICO enquiry, and
    immutable so it can be relied on when it does."""

    list_display = ["email", "verified_at"]
    search_fields = ["email"]
    readonly_fields = ["email", "verified_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
