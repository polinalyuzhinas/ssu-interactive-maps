import json
import logging
from django.core.management.base import BaseCommand
from django.db import IntegrityError
from core.models import Faculties, Groups
from django.core.exceptions import MultipleObjectsReturned

logger = logging.getLogger(__name__)


class Command(BaseCommand):

    def handle(self, *args, **options):
        file_path = 'data/old_schedule_js.json'

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        pairs = set()

        for floor_key, entries in data.items():
            if not isinstance(entries, list):
                continue
            for entry in entries:
                groups = entry.get('group', [])
                faculties = entry.get('faculty', [])
                if not groups or not faculties:
                    continue
                if not isinstance(groups, list):
                    groups = [groups]
                if not isinstance(faculties, list):
                    faculties = [faculties]

                for group_num_str in groups:
                    try:
                        group_num = int(group_num_str)
                    except (ValueError, TypeError):
                        logger.warning(f"Неверный номер группы: {group_num_str}")
                        continue
                    for faculty_name in faculties:
                        pairs.add((group_num, faculty_name))

        created_count = 0
        skipped_count = 0
        not_found_count = 0

        for group_num, faculty_name in pairs:
          faculty = self.get_faculty(faculty_name)
          if faculty is None:
              not_found_count += 1
              continue

          try:
              obj, created = Groups.objects.get_or_create(
                  number=group_num,
                  faculty=faculty,
                  group_type=1,
                  form=1,
              )
              if created:
                  created_count += 1
                  self.stdout.write(f"Создано: {obj}")
              else:
                  skipped_count += 1
          except MultipleObjectsReturned:
              self.stdout.write(self.style.WARNING(
                  f"Пропущено (найдено несколько записей с number={group_num}, faculty={faculty}): группа {group_num} факультет {faculty_name}"
              ))
              skipped_count += 1
          except IntegrityError as e:
              logger.error(f"Ошибка целостности для группы {group_num} факультет {faculty_name}: {e}")
              skipped_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Готово. Создано: {created_count}, Пропущено (уже есть): {skipped_count}, Факультетов не найдено: {not_found_count}"
        ))

    def get_faculty(self, name):
      from core.models import Faculties
      
      normalized = name.strip().lower()
      
      faculty_id_mapping = {
          "психологии": 2,
          "экономический": 3,
          "философский": 5,
      }
      if normalized in faculty_id_mapping:
          try:
              return Faculties.objects.get(id=faculty_id_mapping[normalized])
          except Faculties.DoesNotExist:
              self.stdout.write(self.style.WARNING(f"Факультет с id={faculty_id_mapping[normalized]} не существует в БД"))
              return None
      
      candidates = Faculties.objects.filter(full_name__iexact=name)
      if candidates.count() == 1:
          return candidates.first()
      elif candidates.count() > 1:
          self.stdout.write(self.style.WARNING(f"Найдено несколько факультетов по full_name__iexact='{name}': {[c.full_name for c in candidates]}."))
          return None
      
      candidates = Faculties.objects.filter(short_name__iexact=name)
      if candidates.count() == 1:
          return candidates.first()
      elif candidates.count() > 1:
          self.stdout.write(self.style.WARNING(f"Найдено несколько факультетов по short_name__iexact='{name}': {[c.short_name for c in candidates]}."))
          return None
      
      self.stdout.write(self.style.WARNING(f"Факультет не найден: '{name}'"))
      return None