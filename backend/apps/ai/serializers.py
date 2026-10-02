from rest_framework import serializers


class SearchRequestSerializer(serializers.Serializer):
    query = serializers.CharField(max_length=2000)
    top_k = serializers.IntegerField(min_value=1, max_value=50, required=False)
    document_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)


class SearchResultSerializer(serializers.Serializer):
    chunk_id = serializers.IntegerField()
    document_id = serializers.IntegerField()
    document_name = serializers.CharField()
    page_number = serializers.IntegerField()
    chunk_index = serializers.IntegerField()
    content = serializers.CharField()
    score = serializers.FloatField(help_text="Cosine similarity")
    rerank_score = serializers.FloatField(allow_null=True)


class SearchResponseSerializer(serializers.Serializer):
    query = serializers.CharField()
    embedding_model = serializers.CharField()
    latency_ms = serializers.IntegerField()
    results = SearchResultSerializer(many=True)
