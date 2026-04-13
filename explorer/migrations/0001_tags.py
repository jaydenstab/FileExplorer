from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Tag",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(db_index=True, max_length=64, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name="TaggedFile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("path", models.CharField(db_index=True, max_length=512, unique=True)),
                ("tags", models.ManyToManyField(blank=True, related_name="files", to="explorer.tag")),
            ],
        ),
    ]
