/*global django:true, jQuery:false*/

(function($) {
    'use strict';
    // Устанавливаем глобальный jQuery и $ для совместимости с плагинами
    if (typeof django !== 'undefined' && django.jQuery) {
        window.jQuery = window.$ = django.jQuery;
    }
    // Также экспортируем для модулей
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = window.jQuery;
    }
})(django.jQuery);