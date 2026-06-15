import json
from django.core.management.base import BaseCommand
from django.db import IntegrityError
from django.core.exceptions import MultipleObjectsReturned
from core.models import Lessons, Faculty_Teachers, Faculties


def split_teacher_fullname(fullname):
    parts = fullname.strip().split()
    if len(parts) == 3:
        surname, name, patronymic = parts
    elif len(parts) == 2:
        surname, name = parts
        patronymic = ''
    else:
        surname = fullname
        name = ''
        patronymic = ''
    return surname, name, patronymic


class Command(BaseCommand):

    def handle(self, *args, **options):
        file_path = 'data/old_schedule_js.json'
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        faculty_id_mapping = {
            "психологии": 2,
            "экономический": 3,
            "философский": 5,
        }

        type_mapping = {
            "практика": 1,
            "лекция": 2,
            "лабораторная": 3
        }

        unique_lessons = set()

        for floor_key, entries in data.items():
            if not isinstance(entries, list):
                continue
            for entry in entries:
                lesson_name = entry.get('lesson')
                teacher_fullname = entry.get('teacher')
                faculty_names = entry.get('faculty', [])
                lesson_type_str = entry.get('type')

                if not lesson_name or not teacher_fullname or not faculty_names:
                    continue

                if not isinstance(faculty_names, list):
                    faculty_names = [faculty_names]

                lesson_type = type_mapping.get(lesson_type_str, None)

                for faculty_name in faculty_names:
                    faculty_lower = faculty_name.strip().lower()
                    if faculty_lower in faculty_id_mapping:
                        faculty_id = faculty_id_mapping[faculty_lower]
                    else:
                        try:
                            fac = Faculties.objects.get(full_name__iexact=faculty_name)
                            faculty_id = fac.id
                        except Faculties.DoesNotExist:
                            try:
                                fac = Faculties.objects.get(short_name__iexact=faculty_name)
                                faculty_id = fac.id
                            except Faculties.DoesNotExist:
                                self.stdout.write(self.style.WARNING(
                                    f'Факультет не найден: {faculty_name} (преподаватель {teacher_fullname})'
                                ))
                                continue

                    unique_lessons.add((lesson_name, teacher_fullname, faculty_id, lesson_type))

        created_count = 0
        skipped_count = 0
        not_found_count = 0

        for lesson_name, teacher_fullname, faculty_id, lesson_type in unique_lessons:
            surname, name, patronymic = split_teacher_fullname(teacher_fullname)
            try:
                faculty_teacher = Faculty_Teachers.objects.get(
                    surname=surname,
                    name=name,
                    patronymic=patronymic,
                    faculty_id=faculty_id
                )
            except Faculty_Teachers.DoesNotExist:
                self.stdout.write(self.style.WARNING(
                    f'Faculty_Teachers не найден: "{teacher_fullname}" (фамилия={surname}, имя={name}, отчество={patronymic}, faculty_id={faculty_id})'
                ))
                not_found_count += 1
                continue
            except MultipleObjectsReturned:
                self.stdout.write(self.style.WARNING(
                    f'Найдено несколько Faculty_Teachers: "{teacher_fullname}", faculty_id={faculty_id}'
                ))
                not_found_count += 1
                continue

            try:
                lesson, created = Lessons.objects.get_or_create(
                    name=lesson_name,
                    assignment=faculty_teacher,
                    lesson_type=lesson_type
                )
                if created:
                    created_count += 1
                    self.stdout.write(f'Создана пара: {lesson}')
                else:
                    skipped_count += 1
            except IntegrityError as e:
                self.stdout.write(self.style.WARNING(
                    f'Ошибка целостности для "{lesson_name}": {e}'
                ))
                skipped_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Готово. Создано: {created_count}, Пропущено (уже есть): {skipped_count}, Faculty_Teachers не найдено: {not_found_count}'
        ))