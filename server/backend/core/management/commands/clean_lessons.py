from django.core.management.base import BaseCommand
from core.models import Lessons


class Command(BaseCommand):

    def handle(self, *args, **options):
        to_delete = Lessons.objects.filter(assignment__isnull=True)
        count = to_delete.count()
        to_delete.delete()
        self.stdout.write(self.style.SUCCESS(
            f'Удалено записей: {count}'
        ))