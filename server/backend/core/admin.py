import json
from django.db import models
from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from .models import Auditoriums, Auditorium_Types, Lessons, Faculty_Teachers, Faculties, Lessons_Schedule, Groups_Schedule, Groups
from django.contrib.admin.sites import site
from django.http import JsonResponse
from django.contrib.admin.views.decorators import staff_member_required
from django.apps import apps
from django.views.decorators.http import require_http_methods

@staff_member_required
@require_http_methods(["POST"])
def update_cell(request, app_label, model_name):  
    try:
        data = json.loads(request.body)
        pk = data.get('pk')
        field = data.get('field')
        value = data.get('value')
        
        model = apps.get_model(app_label, model_name)
        obj = model.objects.get(pk=pk)
        
        model_field = model._meta.get_field(field)
        
        # ForeignKey
        if model_field.is_relation and model_field.many_to_one:
            if value and value != '':
                try:
                    related_pk = int(value)
                except (ValueError, TypeError):
                    related_pk = value
                
                related_model = model_field.related_model
                value = related_model.objects.get(pk=related_pk)
            else:
                value = None
                
        # BooleanField
        elif model_field.get_internal_type() == 'BooleanField':
            value = value == 'True'
            
        # with choices
        elif hasattr(model_field, 'choices') and model_field.choices:
            # trying to convert to int
            first_choice = model_field.choices[0][0]
            if isinstance(first_choice, int):
                try:
                    value = int(value)
                except (ValueError, TypeError):
                    pass
            
        setattr(obj, field, value)
        
        obj.save()
        
        obj.refresh_from_db()
        
        return JsonResponse({'success': True, 'message': 'Saved'})
        
    except Exception as e:
        print(f"\nerror: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=400)
    
@staff_member_required
def get_field_info(request, app_label, model_name, field_name):
    try:
        model = apps.get_model(app_label, model_name)
        field = model._meta.get_field(field_name)
        
        if field.is_relation and field.many_to_one:
            related_model = field.related_model
            choices = []
            for obj in related_model.objects.all()[:100]:
                choices.append({
                    'value': str(obj.pk),
                    'label': str(obj)
                })
            return JsonResponse({'type': 'foreignkey', 'choices': choices})
        
        elif hasattr(field, 'choices') and field.choices:
            choices = []
            for value, label in field.choices:
                choices.append({
                    'value': str(value),
                    'label': str(label)
                })
            return JsonResponse({'type': 'choices', 'choices': choices})
        
        elif field.get_internal_type() == 'BooleanField':
            choices = [
                {'value': 'True', 'label': 'Да'},
                {'value': 'False', 'label': 'Нет'},
            ]
            return JsonResponse({'type': 'boolean', 'choices': choices})
        
        else:
            return JsonResponse({'type': 'text', 'choices': []})
            
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)
    
@staff_member_required
def autocomplete_view(request):
    try:
        term = request.GET.get('term', '').strip()
        app_label = request.GET.get('app_label')
        model_name = request.GET.get('model_name')
        field_name = request.GET.get('field_name')
        
        if not all([app_label, model_name, field_name]):
            return JsonResponse({'results': []})
        
        model = apps.get_model(app_label, model_name)
        
        queryset = model.objects.exclude(**{f'{field_name}__isnull': True})
        queryset = queryset.exclude(**{f'{field_name}__exact': ''})
        
        if term:
            queryset = queryset.filter(**{f'{field_name}__icontains': term})
        
        values = queryset.values_list(field_name, flat=True).distinct()[:20]
        
        results = [{'id': val, 'text': str(val)} for val in values if val]
        
        return JsonResponse({'results': results})
        
    except Exception as e:
        return JsonResponse({'error': str(e), 'results': []}, status=400)
    
def get_field_choices(field):
    choices = []
    
    if hasattr(field, 'choices') and field.choices:
        for value, label in field.choices:
            choices.append({
                'value': value,
                'label': str(label)
            })
        return choices

    if field.is_relation and field.many_to_one:
        related_model = field.related_model
        qs = related_model.objects.all()
        for obj in qs:
            choices.append({
                'value': obj.pk,
                'label': str(obj)
            })
        return choices

    return choices

def get_field_type(field):
    if isinstance(field, models.BooleanField):
        return 'boolean'
    if field.is_relation and field.many_to_one:
        return 'foreignkey'
    if hasattr(field, 'choices') and field.choices:
        return 'choices'
    if isinstance(field, (models.TextField, models.CharField)):
        return 'text'
    return 'default'

class BaseModelAdminMixin:
    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['app_list'] = site.get_app_list(request)
        response = super().changelist_view(request, extra_context)
        
        model = self.model
        field_info = {}
        
        for field_name in self.list_display:
            try:
                field = model._meta.get_field(field_name)
                field_type = get_field_type(field)
                
                field_info[field_name] = {
                    'type': field_type,
                    'name': field_name,
                    'choices': get_field_choices(field),
                    'verbose_name': field.verbose_name or field_name,
                    'editable': field.editable,
                }
            except Exception as e:
                field_info[field_name] = {
                    'type': 'default',
                    'name': field_name,
                    'choices': [],
                    'verbose_name': field_name.replace('_', ' ').title(),
                    'editable': True,
                }
        
        response.context_data['field_info'] = field_info
        response.context_data['model_meta'] = {
            'app_label': model._meta.app_label,
            'model_name': model._meta.model_name,
        }
        
        return response
    
admin.site.site_header = _("Отредактировать расписание")
admin.site.index_title = ""


@admin.register(Auditoriums)
class AuditoriumsAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('number', 'floor', 'auditorium_type', 'have_lessons')
    list_per_page = 10

@admin.register(Auditorium_Types)
class AuditoriumsTypesAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('name', )
    list_per_page = 10

@admin.register(Faculties)
class FacultiesAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('full_name', 'short_name')
    list_per_page = 10

@admin.register(Faculty_Teachers)
class FacultyTeachersAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('surname', 'name', 'patronymic', 'faculty')
    list_per_page = 10

@admin.register(Lessons) 
class LessonsAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'assignment', 'lesson_type')
    list_per_page = 10

@admin.register(Groups)
class GroupsAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('number', 'faculty', 'group_type', 'form')
    list_per_page = 10
  
@admin.register(Groups_Schedule)
class GroupsScheduleAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('group', 'lesson')
    list_per_page = 10

@admin.register(Lessons_Schedule)
class LessonsScheduleAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('lesson', 'auditorium', 'subgroup', 'week_day', 'time', 'parity')
    list_per_page = 10