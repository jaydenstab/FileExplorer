from django.db import models


class Tag(models.Model):
    name = models.CharField(max_length=64, unique=True, db_index=True)

    def __str__(self) -> str:  # pragma: no cover
        return self.name


class TaggedFile(models.Model):
    path = models.CharField(max_length=512, unique=True, db_index=True)
    tags = models.ManyToManyField(Tag, related_name="files", blank=True)

    def __str__(self) -> str:  # pragma: no cover
        return self.path


class ExplorerSettings(models.Model):
    """Singleton-style row for explorer configuration (pk ``default``)."""

    key = models.CharField(max_length=32, primary_key=True, default="default")
    document_root_dirs = models.JSONField(default=list)

    class Meta:
        verbose_name_plural = "Explorer settings"

    def __str__(self) -> str:  # pragma: no cover
        return self.key
