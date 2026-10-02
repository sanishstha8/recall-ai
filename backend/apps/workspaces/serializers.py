from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.workspaces.models import Role, Workspace, WorkspaceMember

User = get_user_model()


class WorkspaceSerializer(serializers.ModelSerializer):
    role = serializers.CharField(read_only=True, help_text="The current user's role.")
    member_count = serializers.IntegerField(read_only=True)
    knowledge_base_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Workspace
        fields = [
            "id",
            "name",
            "slug",
            "owner",
            "role",
            "member_count",
            "knowledge_base_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "owner", "created_at", "updated_at"]

    def validate_name(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("Name cannot be blank.")
        return value.strip()


class MemberUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "full_name", "avatar"]


class WorkspaceMemberSerializer(serializers.ModelSerializer):
    user = MemberUserSerializer(read_only=True)

    class Meta:
        model = WorkspaceMember
        fields = ["id", "user", "role", "joined_at"]
        read_only_fields = ["id", "user", "joined_at"]


class AddMemberSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=Role.choices, default=Role.MEMBER)

    def validate_email(self, value: str):
        user = User.objects.filter(email__iexact=value.strip(), is_active=True).first()
        if user is None:
            raise serializers.ValidationError("No RecallAI account exists with this email.")
        return user


class UpdateMemberSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Role.choices)
