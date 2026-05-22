from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        FOI_TEAM = 'foi_team', 'FOI Team'
        ASSIGNEE = 'assignee', 'Assignee'

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.FOI_TEAM)
    department = models.CharField(max_length=200, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def is_foi_team(self):
        return self.role == self.Role.FOI_TEAM

    def __str__(self):
        return self.get_full_name() or self.email


class Notification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications'
    )
    message = models.CharField(max_length=500)
    link = models.CharField(max_length=500, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user} — {self.message[:60]}'
