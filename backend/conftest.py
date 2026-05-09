import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def foi_team_user(db):
    return User.objects.create_user(
        email='officer@example.com',
        username='officer',
        password='testpass123',
        role=User.Role.FOI_TEAM,
    )


@pytest.fixture
def assignee_user(db):
    return User.objects.create_user(
        email='assignee@example.com',
        username='assignee',
        password='testpass123',
        role=User.Role.ASSIGNEE,
        department='IT',
    )
