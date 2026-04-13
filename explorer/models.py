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
