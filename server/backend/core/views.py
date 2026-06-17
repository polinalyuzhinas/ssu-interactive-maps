# =============================================================================
# api endpoints для приложения c интерактивной картой
# =============================================================================
# Содержит два публичных read-only endpoint'а, используемых фронтендом:
#   1. /api/filters/?floor=N       - уникальные значения для глобальных фильтров
#   2. /api/schedule/<number>/     - полное расписание конкретной аудитории
#
# Оба endpoint'а возвращают JSON и не требуют авторизации (публичные данные).
# =============================================================================

# JSON-ответы для API
from django.http import JsonResponse
# Ограничение HTTP-методов на только GET
from django.views.decorators.http import require_GET
# Динамическое получение моделей по имени (без циклических импортов)
from django.apps import apps

@require_GET
def get_filter_options(request):
    try:
        floor = request.GET.get('floor')
        if not floor:
            return JsonResponse(
                {'success': False, 'error': 'floor parameter required'},
                status=400
            )
        
        Lessons_Schedule = apps.get_model('core', 'Lessons_Schedule')
        
        qs = Lessons_Schedule.objects.filter(
            auditorium__floor=int(floor)
        ).select_related(
            'lesson__lesson__assignment__faculty',
            'lesson__group__faculty'
        )
        
        departments = set()
        groups = set()
        subgroups = set()
        teachers = set()
        lessons = set()
        types = set()
        parities = set()
        
        for item in qs:
            gs = item.lesson
            lesson = gs.lesson if gs else None
            group = gs.group if gs else None
            assignment = lesson.assignment if lesson else None
            
            if group and group.faculty:
                fac = group.faculty.short_name or group.faculty.full_name
                if fac:
                    departments.add(fac)
            elif assignment and assignment.faculty:
                fac = assignment.faculty.short_name or assignment.faculty.full_name
                if fac:
                    departments.add(fac)
            
            if group:
                groups.add(str(group.number))
            
            if item.subgroup is not None:
                try:
                    disp = item.get_subgroup_display()
                    if disp:
                        subgroups.add(disp)
                except Exception:
                    pass
            
            if assignment:
                surname = assignment.surname or ''
                name = assignment.name or ''
                patronymic = assignment.patronymic or ''
                name_initial = f"{name[0]}." if name else ''
                patronymic_initial = f"{patronymic[0]}." if patronymic else ''
                teacher_name = f"{surname} {name_initial}{patronymic_initial}".strip()
                if teacher_name:
                    teachers.add(teacher_name)
            
            if lesson and lesson.name:
                lessons.add(lesson.name)
            
            if lesson and lesson.lesson_type is not None:
                disp = lesson.get_lesson_type_display()
                if disp:
                    types.add(disp)
            
            if item.parity is not None:
                disp = item.get_parity_display()
                if disp:
                    parities.add(disp)
        
        def safe_sort(s):
            return sorted([str(x) for x in s if x is not None and x != ''])
        
        return JsonResponse({
            'success': True,
            'floor': int(floor),
            'options': {
                'department': safe_sort(departments),
                'group': safe_sort(groups),
                'subgroup': safe_sort(subgroups),
                'teacher': safe_sort(teachers),
                'lesson': safe_sort(lessons),
                'type': safe_sort(types),
                'parity': safe_sort(parities),
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

 
@require_GET
def get_auditorium_schedule(request, auditorium_number):
    try:
        Auditoriums = apps.get_model('core', 'Auditoriums')
        Lessons_Schedule = apps.get_model('core', 'Lessons_Schedule')
        
        try:
            auditorium = Auditoriums.objects.get(number=auditorium_number)
        except Auditoriums.DoesNotExist:
            return JsonResponse({
                'success': True,
                'auditorium': auditorium_number,
                'description': f'Аудитория {auditorium_number}',
                'schedule': []
            })
        
        schedule_qs = Lessons_Schedule.objects.filter(
            auditorium=auditorium
        ).select_related(
            'lesson',
            'lesson__lesson',
            'lesson__lesson__assignment',
            'lesson__lesson__assignment__faculty',
            'lesson__group',
            'lesson__group__faculty',
        ).order_by('week_day', 'time')
        
        schedule_data = []
        for item in schedule_qs:
            groups_schedule = item.lesson
            lesson = groups_schedule.lesson if groups_schedule else None
            group = groups_schedule.group if groups_schedule else None
            assignment = lesson.assignment if lesson else None
            
            teacher_name = ''
            teacher_faculty = []
            
            if assignment:
                surname = assignment.surname or ''
                name = assignment.name or ''
                patronymic = assignment.patronymic or ''
                name_initial = f"{name[0]}." if name else ''
                patronymic_initial = f"{patronymic[0]}." if patronymic else ''
                teacher_name = f"{surname} {name_initial}{patronymic_initial}".strip()
                
                if assignment.faculty:
                    fac_name = assignment.faculty.short_name or assignment.faculty.full_name
                    if fac_name:
                        teacher_faculty = [fac_name]
            
            group_list = []
            group_faculty = []
            
            if group:
                group_list = [str(group.number)]
                if group.faculty:
                    fac_name = group.faculty.short_name or group.faculty.full_name
                    if fac_name:
                        group_faculty = [fac_name]
            
            subgroup_display = ''
            if item.subgroup is not None:
                try:
                    subgroup_display = item.get_subgroup_display()
                except Exception:
                    subgroup_display = str(item.subgroup)
            
            schedule_data.append({
                'day': item.get_week_day_display() if item.week_day else '',
                'number': item.get_time_display() if item.time else '',
                'parity': item.get_parity_display() if item.parity is not None else '',
                'department': group_faculty or teacher_faculty,
                'group': group_list,
                'subgroup': subgroup_display,
                'teacher': teacher_name,
                'lesson': lesson.name if lesson else '',
                'type': lesson.get_lesson_type_display() if lesson and lesson.lesson_type is not None else '',
                'comment': item.comment or ''
            })
        
        return JsonResponse({
            'success': True,
            'auditorium': auditorium_number,
            'description': str(auditorium),
            'schedule': schedule_data
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)