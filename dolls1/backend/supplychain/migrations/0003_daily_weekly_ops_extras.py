from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("supplychain", "0002_monthly_doll_unit_sale"),
    ]

    operations = [
        migrations.AddField(
            model_name="dailytarget",
            name="on_time_ship_rate",
            field=models.DecimalField(blank=True, decimal_places=4, max_digits=7, null=True),
        ),
        migrations.AddField(
            model_name="dailytarget",
            name="season_window",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="weeklytarget",
            name="on_time_ship_rate",
            field=models.DecimalField(blank=True, decimal_places=4, max_digits=7, null=True),
        ),
        migrations.AddField(
            model_name="weeklytarget",
            name="ending_backlog",
            field=models.IntegerField(default=0),
        ),
    ]
