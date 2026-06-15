import json
from django.core.management.base import BaseCommand
from django.db import IntegrityError
from core.models import (
    Groups, Lessons, Faculty_Teachers, Faculties, Groups_Schedule, Auditoriums, Lessons_Schedule
)

DAY_MAP = {
    "Понедельник": 1,
    "Вторник": 2,
    "Среда": 3,
    "Четверг": 4,
    "Пятница": 5,
    "Суббота": 6,
}

PARITY_MAP = {
    "числитель": 1,
    "знаменатель": 2,
    None: 0,
}

FACULTY_ID_MAP = {
    "психологии": 2,
    "экономический": 3,
    "философский": 5,
}


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

        created_count = 0
        skipped_count = 0
        no_auditorium = 0
        no_groups_schedule = 0
        no_group = 0
        no_lesson = 0
        no_faculty_teacher = 0
        no_auditorium_obj = 0

        for floor_key, entries in data.items():
            if not isinstance(entries, list):
                continue
            for entry in entries:
                day = entry.get('day')
                time_num = entry.get('number')
                auditorium_num = entry.get('auditorium')
                subgroup = entry.get('subgroup')
                parity_str = entry.get('parity')
                lesson_name = entry.get('lesson')
                teacher_fullname = entry.get('teacher')
                faculty_names = entry.get('faculty', [])
                group_numbers = entry.get('group', [])

                if not day or not time_num or not auditorium_num or not lesson_name or not teacher_fullname or not faculty_names or not group_numbers:
                    continue

                week_day = DAY_MAP.get(day)
                if week_day is None:
                    self.stdout.write(self.style.WARNING(f'Неизвестный день: {day}'))
                    continue

                try:
                    time_int = int(time_num)
                except (ValueError, TypeError):
                    self.stdout.write(self.style.WARNING(f'Неверный номер пары: {time_num}'))
                    continue

                parity = PARITY_MAP.get(parity_str, 0)

                if subgroup is None:
                    subgroup_int = 0
                else:
                    try:
                        subgroup_int = int(subgroup)
                        if subgroup_int not in [1, 2, 3, 0]:
                            self.stdout.write(self.style.WARNING(f'Неверная подгруппа: {subgroup}'))
                            continue
                    except (ValueError, TypeError):
                        self.stdout.write(self.style.WARNING(f'Неверная подгруппа: {subgroup}'))
                        continue

                try:
                    auditorium = Auditoriums.objects.get(number=auditorium_num)
                except Auditoriums.DoesNotExist:
                    self.stdout.write(self.style.WARNING(f'Аудитория не найдена: {auditorium_num}'))
                    no_auditorium += 1
                    continue

                surname, name, patronymic = split_teacher_fullname(teacher_fullname)

                for faculty_name in faculty_names:
                    faculty_lower = faculty_name.strip().lower()
                    if faculty_lower in FACULTY_ID_MAP:
                        faculty_id = FACULTY_ID_MAP[faculty_lower]
                    else:
                        try:
                            fac = Faculties.objects.get(full_name__iexact=faculty_name)
                            faculty_id = fac.id
                        except Faculties.DoesNotExist:
                            try:
                                fac = Faculties.objects.get(short_name__iexact=faculty_name)
                                faculty_id = fac.id
                            except Faculties.DoesNotExist:
                                self.stdout.write(self.style.WARNING(f'Факультет не найден: {faculty_name}'))
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
                            f'Faculty_Teachers не найден: "{teacher_fullname}" на факультете {faculty_name}'
                        ))
                        no_faculty_teacher += 1
                        continue
                    except Faculty_Teachers.MultipleObjectsReturned:
                        self.stdout.write(self.style.WARNING(
                            f'Найдено несколько Faculty_Teachers: "{teacher_fullname}" на факультете {faculty_name}'
                        ))
                        continue

                    try:
                        lesson = Lessons.objects.get(
                            name=lesson_name,
                            assignment=faculty_teacher
                        )
                    except Lessons.DoesNotExist:
                        self.stdout.write(self.style.WARNING(
                            f'Lesson не найден: "{lesson_name}" для преподавателя "{teacher_fullname}"'
                        ))
                        no_lesson += 1
                        continue
                    except Lessons.MultipleObjectsReturned:
                        self.stdout.write(self.style.WARNING(
                            f'Найдено несколько Lessons: "{lesson_name}" для преподавателя "{teacher_fullname}"'
                        ))
                        continue

                    for group_num_str in group_numbers:
                        try:
                            group_num = int(group_num_str)
                        except (ValueError, TypeError):
                            self.stdout.write(self.style.WARNING(f'Неверный номер группы: {group_num_str}'))
                            continue

                        groups_qs = Groups.objects.filter(
                            number=group_num,
                            faculty_id=faculty_id,
                            form=1
                        )
                        if not groups_qs.exists():
                            self.stdout.write(self.style.WARNING(
                                f'Группа не найдена: {group_num} (факультет {faculty_name})'
                            ))
                            no_group += 1
                            continue

                        for group in groups_qs:
                            try:
                                groups_schedule = Groups_Schedule.objects.get(
                                    group=group,
                                    lesson=lesson
                                )
                            except Groups_Schedule.DoesNotExist:
                                self.stdout.write(self.style.WARNING(
                                    f'Groups_Schedule не найден: группа {group_num} ({group.get_group_type_display()}), пара "{lesson_name}"'
                                ))
                                no_groups_schedule += 1
                                continue
                            except Groups_Schedule.MultipleObjectsReturned:
                                self.stdout.write(self.style.WARNING(
                                    f'Найдено несколько Groups_Schedule: группа {group_num} ({group.get_group_type_display()}), пара "{lesson_name}"'
                                ))
                                continue

                            try:
                                ls, created = Lessons_Schedule.objects.get_or_create(
                                    lesson=groups_schedule,
                                    auditorium=auditorium,
                                    subgroup=subgroup_int,
                                    week_day=week_day,
                                    time=time_int,
                                    parity=parity,
                                    defaults={'comment': ''}
                                )
                                if created:
                                    created_count += 1
                                    self.stdout.write(f'Создано: {ls}')
                                else:
                                    skipped_count += 1
                            except IntegrityError as e:
                                self.stdout.write(self.style.WARNING(
                                    f'Ошибка целостности для группы {group_num}, пары "{lesson_name}": {e}'
                                ))
                                skipped_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Готово. Создано: {created_count}, Пропущено (уже есть): {skipped_count}\n'
            f'Аудиторий не найдено: {no_auditorium}, Групп не найдено: {no_group}, '
            f'Пар не найдено: {no_lesson}, Groups_Schedule не найдено: {no_groups_schedule}, '
            f'Faculty_Teachers не найдено: {no_faculty_teacher}'
        ))