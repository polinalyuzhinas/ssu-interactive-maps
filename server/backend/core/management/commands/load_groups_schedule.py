# management/commands/load_groups_schedule.py
import json
from django.core.management.base import BaseCommand
from django.db import IntegrityError
from core.models import Groups, Lessons, Faculty_Teachers, Faculties, Groups_Schedule


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

        created_count = 0
        skipped_count = 0
        group_not_found = 0
        lesson_not_found = 0
        faculty_not_found = 0

        for floor_key, entries in data.items():
            if not isinstance(entries, list):
                continue
            for entry in entries:
                lesson_name = entry.get('lesson')
                teacher_fullname = entry.get('teacher')
                faculty_names = entry.get('faculty', [])
                group_numbers = entry.get('group', [])

                if not lesson_name or not teacher_fullname or not faculty_names or not group_numbers:
                    continue

                if not isinstance(faculty_names, list):
                    faculty_names = [faculty_names]
                if not isinstance(group_numbers, list):
                    group_numbers = [group_numbers]

                surname, name, patronymic = split_teacher_fullname(teacher_fullname)

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
                                    f'Факультет не найден: {faculty_name}'
                                ))
                                faculty_not_found += 1
                                continue

                    try:
                        faculty_teacher = Faculty_Teachers.objects.get(
                            surname=surname,
                            name=name,
                            patronymic=patronymic,
                            faculty_id=faculty_id
                        )
                    except Faculty_Teachers.DoesNotExist:
                        self.stdout.write(self.style.WARNING(
                            f'Faculty_Teachers не найден: "{teacher_fullname}" на факультете id={faculty_id}'
                        ))
                        faculty_not_found += 1
                        continue
                    except Faculty_Teachers.MultipleObjectsReturned:
                        self.stdout.write(self.style.WARNING(
                            f'Найдено несколько Faculty_Teachers: "{teacher_fullname}" на факультете id={faculty_id}'
                        ))
                        faculty_not_found += 1
                        continue

                    lessons_qs = Lessons.objects.filter(
                        name=lesson_name,
                        assignment=faculty_teacher
                    )
                    if not lessons_qs.exists():
                        self.stdout.write(self.style.WARNING(
                            f'Lesson не найдена: "{lesson_name}" для преподавателя "{teacher_fullname}"'
                        ))
                        lesson_not_found += 1
                        continue
                    for lesson in lessons_qs:
                        for group_num_str in group_numbers:
                            try:
                                group_num = int(group_num_str)
                            except (ValueError, TypeError):
                                self.stdout.write(self.style.WARNING(
                                    f'Неверный номер группы: {group_num_str}'
                                ))
                                continue

                            groups_qs = Groups.objects.filter(
                                number=group_num,
                                faculty_id=faculty_id,
                                form=1
                            )
                            if not groups_qs.exists():
                                self.stdout.write(self.style.WARNING(
                                    f'Группа не найдена: {group_num} (факультет id={faculty_id})'
                                ))
                                group_not_found += 1
                                continue

                            for group in groups_qs:
                                try:
                                    link, created = Groups_Schedule.objects.get_or_create(
                                        group=group,
                                        lesson=lesson
                                    )
                                    if created:
                                        created_count += 1
                                    else:
                                        skipped_count += 1
                                except IntegrityError as e:
                                    self.stdout.write(self.style.WARNING(
                                        f'Ошибка целостности для группы {group_num}, пары "{lesson_name}": {e}'
                                    ))
                                    skipped_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Готово. Создано: {created_count}, Пропущено (уже есть): {skipped_count}, '
            f'Групп не найдено: {group_not_found}, Пар не найдено: {lesson_not_found}, '
            f'Faculty_Teachers не найдено: {faculty_not_found}'
        ))