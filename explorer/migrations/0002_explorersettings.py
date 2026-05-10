from django.db import migrations, models


def seed_explorer_settings(apps, schema_editor):
    ExplorerSettings = apps.get_model("explorer", "ExplorerSettings")
    ExplorerSettings.objects.get_or_create(
        key="default",
        defaults={"document_root_dirs": ["documents1", "documents2"]},
    )


class Migration(migrations.Migration):

    dependencies = [
        ("explorer", "0001_tags"),
    ]

    operations = [
        migrations.CreateModel(
            name="ExplorerSettings",
            fields=[
                ("key", models.CharField(default="default", max_length=32, primary_key=True, serialize=False)),
                ("document_root_dirs", models.JSONField(default=list)),
            ],
            options={
                "verbose_name_plural": "Explorer settings",
            },
        ),
        migrations.RunPython(seed_explorer_settings, migrations.RunPython.noop),
    ]
