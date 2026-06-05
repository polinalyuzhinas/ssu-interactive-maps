from django import template
from django.contrib.admin.templatetags.admin_list import result_headers

register = template.Library()

@register.inclusion_tag('admin/change_list_results.html', takes_context=True)
def custom_result_list(context, cl):
    """
    Передаёт сырые объекты моделей в шаблон.
    """
    # Получаем заголовки (это готово к использованию)
    headers = list(result_headers(cl))
    
    # Получаем сырые объекты из result_list (это модели)
    results = list(cl.result_list)  # Список объектов моделей
    
    # Получаем скрытые поля
    result_hidden_fields = list(cl.result_hidden_fields) if hasattr(cl, 'result_hidden_fields') else []
    
    # Обновляем контекст
    context.update({
        'cl': cl,
        'result_headers': headers,
        'results': results,  # ← теперь это объекты моделей!
        'result_hidden_fields': result_hidden_fields,
        'field_info': context.get('field_info', {}),
        'model_meta': context.get('model_meta', {}),
    })
    
    return context.flatten()