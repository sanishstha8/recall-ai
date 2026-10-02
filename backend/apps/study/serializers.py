from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.documents.models import Document
from apps.knowledge.models import KnowledgeBase
from apps.study.models import Difficulty, QuizAttempt, StudyKind, StudySet, StudySetStatus

COUNT_LIMITS = {
    StudyKind.SUMMARY: (1, 1),
    StudyKind.FLASHCARDS: (3, 30),
    StudyKind.QUIZ: (3, 25),
    StudyKind.QUESTIONS: (2, 20),
    StudyKind.MOCK_EXAM: (5, 50),
}


class StudyRequestSerializer(serializers.Serializer):
    knowledge_base = serializers.PrimaryKeyRelatedField(queryset=KnowledgeBase.objects.all())
    document = serializers.PrimaryKeyRelatedField(
        queryset=Document.objects.all(), required=False, allow_null=True
    )
    topic = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
    title = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    count = serializers.IntegerField(required=False, min_value=1, max_value=50)
    difficulty = serializers.ChoiceField(choices=Difficulty.choices, default=Difficulty.MEDIUM)
    time_limit_minutes = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=240)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request is not None:
            from apps.documents.selectors import scoped_documents
            from apps.knowledge.selectors import scoped_knowledge_bases

            self.fields["knowledge_base"].queryset = scoped_knowledge_bases(request.user)
            self.fields["document"].queryset = scoped_documents(request.user)

    @property
    def kind(self) -> str:
        return self.context.get("kind", StudyKind.QUIZ)

    def validate(self, attrs):
        low, high = COUNT_LIMITS[self.kind]
        default = {StudyKind.MOCK_EXAM: 20, StudyKind.SUMMARY: 1}.get(self.kind, 10)
        count = attrs.get("count") or default
        if not low <= count <= high:
            raise serializers.ValidationError({"count": f"Choose between {low} and {high}."})
        attrs["count"] = count
        document = attrs.get("document")
        if document is not None and document.knowledge_base_id != attrs["knowledge_base"].pk:
            raise serializers.ValidationError({"document": "Document is not in this knowledge base."})
        if self.kind == StudyKind.MOCK_EXAM and "time_limit_minutes" not in attrs:
            attrs["time_limit_minutes"] = max(5, count * 1.5).__ceil__()
        return attrs


class StudySetSerializer(serializers.ModelSerializer):
    knowledge_base_name = serializers.CharField(source="knowledge_base.name", read_only=True)
    document_name = serializers.CharField(source="document.name", read_only=True, default=None)
    content = serializers.SerializerMethodField()
    attempt_count = serializers.IntegerField(read_only=True, default=0)
    best_score = serializers.FloatField(read_only=True, default=None)

    class Meta:
        model = StudySet
        fields = [
            "id",
            "workspace",
            "knowledge_base",
            "knowledge_base_name",
            "document",
            "document_name",
            "kind",
            "title",
            "status",
            "difficulty",
            "topic",
            "item_count",
            "time_limit_minutes",
            "content",
            "sources",
            "model",
            "error",
            "attempt_count",
            "best_score",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [f for f in fields if f != "title"]

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_content(self, obj):
        # Mock-exam answers are only revealed through a submitted attempt.
        if obj.kind == StudyKind.MOCK_EXAM and obj.status == StudySetStatus.READY:
            return {
                "questions": [
                    {k: v for k, v in q.items() if k not in ("answer", "explanation")}
                    for q in obj.content.get("questions", [])
                ]
            }
        return obj.content


class StudySetListSerializer(StudySetSerializer):
    class Meta(StudySetSerializer.Meta):
        fields = [f for f in StudySetSerializer.Meta.fields if f not in ("content",)]


class AttemptRequestSerializer(serializers.Serializer):
    answers = serializers.DictField(
        child=serializers.CharField(max_length=1, allow_blank=True),
        help_text='Map of question id to chosen option letter, e.g. {"1": "B", "2": "D"}',
    )
    duration_seconds = serializers.IntegerField(min_value=0, default=0)


class QuizAttemptSerializer(serializers.ModelSerializer):
    percentage = serializers.FloatField(read_only=True)

    class Meta:
        model = QuizAttempt
        fields = [
            "id",
            "study_set",
            "answers",
            "results",
            "score",
            "total",
            "percentage",
            "duration_seconds",
            "created_at",
        ]
