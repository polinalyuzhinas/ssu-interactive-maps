import OLMap from 'ol/Map.js';
import View from 'ol/View.js';
import ImageLayer from 'ol/layer/Image.js';
import StaticImage from 'ol/source/ImageStatic.js';
import { Projection, get } from 'ol/proj.js';
import 'ol/ol.css';
import proj4 from 'proj4';

// инструменты для векторных слоёв
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';

import Overlay from 'ol/Overlay'; // нужно для всплывающей надписи

const imageWidth = 3322;
const imageHeight = 2014;
const imageExtent = [0, 0, imageWidth, imageHeight];

// определяем пользовательскую проекцию pixel-image
proj4.defs("pixel-image", "+proj=identity +units=pixels +extent=0,0," + imageWidth + "," + imageHeight);

// получаем пользовательскую проекцию OpenLayers
const proj = new Projection({
    code: 'pixel-image',
    units: 'pixels',
    extent: imageExtent
});

const vectorSource = new VectorSource();

// cоздание векторного слоя
const vectorLayer = new VectorLayer({
  source: vectorSource,
  style: function (feature) {
    return feature.getStyle();
  }
});

const defaultStyle = new Style({ // стиль по умолчанию
    fill: new Fill({
        color: 'rgba(255, 255, 255, 0.01)'
      }), // заливка
    });
  
const highlightStyle = new Style({ // стиль при наведении курсора
fill: new Fill({
    color: 'rgba(98, 87, 255, 0.3)'
})
});

const polygonFeatures = new Map();
const scheduleCache = new Map();
let openModal = null;

let currentFilters = {};
let currentFloor = null;

function extractAuditoriumNumber(description) {
    const match = description.match(/^(\d+)/);
    return match ? match[1] : null;
}

// функция для загрузки расписания с API
async function fetchSchedule(auditoriumNumber) {
    if (!auditoriumNumber) return [];
    
    if (scheduleCache.has(auditoriumNumber)) {
        return scheduleCache.get(auditoriumNumber);
    }
    
    try {
        const response = await fetch(`/api/schedule/${auditoriumNumber}/`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const schedule = data.schedule || [];
        
        scheduleCache.set(auditoriumNumber, schedule);
        return schedule;
    } catch (error) {
        console.error('Ошибка загрузки расписания:', error);
        return [];
    }
}

// загрузка глобальных фильтров при старте
async function loadFilterOptions(floor) {
    try {
        const response = await fetch(`/api/filters/?floor=${floor}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        
        return data.options || {};
    } catch (error) {
        console.error('Ошибка загрузки фильтров:', error);
        return {};
    }
}

function template_polygon_feature(coordinates, description, featureID) {
    const feature = new Feature({
        geometry: new Polygon(coordinates)
    });
    feature.set('description', description);
    feature.setStyle(defaultStyle);
    vectorSource.addFeature(feature);
    polygonFeatures.set(featureID, feature);
}

function filterSchedule(schedule, filters) {
    if (!schedule || schedule.length === 0) return [];
    return schedule.filter(item => {
        for (const filterName in filters) {
            const filterValue = filters[filterName];
            const itemValue = item[filterName];
            if (Array.isArray(itemValue)) {
                if (!itemValue.includes(filterValue)) return false;
            } else {
                if (itemValue !== filterValue) return false;
            }
        }
        return true;
    });
}

function create_popup() {
    const popup = new Overlay({
        element: document.createElement('div'),
        autoPan: true,
    });

    popup.getElement().className = 'ol-popup';

    return popup;
}

function create_map(image_url) {
    const imageLayer = new ImageLayer({ // слой с изображением (статичным)
    source: new StaticImage({
        url: image_url,
        projection: proj,
        imageExtent: imageExtent,
        })
    });

    const initialCenter = [imageWidth / 2, imageHeight / 2];

    const map = new OLMap({
    target: "map",
        layers: [imageLayer, vectorLayer],
        view: new View({
            projection: proj,
            center: initialCenter,
            zoom: 0, // начальный зум
            minZoom: 0.98,
            maxZoom: 4,
        }),
    });

    map.getView().fit(imageExtent); // автоматический подбор масштаба карты

    return map;
}

// обработчик события наведения курсора мыши
function pointermove(map, defaultStyle, highlightStyle, popup) {
    
    let highlightedFeature = null;

    map.on('pointermove', function (evt) {
        if (evt.dragging) {
            return;
        }

        const pixel = map.getEventPixel(evt.originalEvent);
        map.getTargetElement().style.cursor = map.hasFeatureAtPixel(pixel) ? 'pointer' : '';

        const features = [];
        map.forEachFeatureAtPixel(pixel, function (feature) {
            features.push(feature);
        });

        if (highlightedFeature && !features.includes(highlightedFeature)) {
            highlightedFeature.setStyle(defaultStyle);
            highlightedFeature = null;
        }

        let featureToShowPopup = null;
        features.forEach(feature => {
            if (feature) {
                feature.setStyle(highlightStyle);
                highlightedFeature = feature;
                featureToShowPopup = feature;
            }
        });

        if (featureToShowPopup) {
            const coordinate = evt.coordinate;
            popup.getElement().innerHTML = featureToShowPopup.get('description');
            popup.setPosition(coordinate);
        } else {
            popup.setPosition(undefined);
        }
    });
}

function click(map, showScheduleModal) {
    map.on('click', async function (evt) {
        const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
        if (!feature) return;
        
        const description = feature.get('description');
        const id = feature.get('featureID');
        
        if (openModal) {
            document.body.removeChild(openModal);
            openModal = null;
        }
        
        const loadingModal = document.createElement('div');
        loadingModal.className = 'loading-modal';
        loadingModal.innerHTML = `<div class="modal-content"><p>Загрузка расписания...</p></div>`;
        document.body.appendChild(loadingModal);
        
        try {
            const auditoriumNumber = extractAuditoriumNumber(description);
            
            if (!auditoriumNumber) {
                document.body.removeChild(loadingModal);
                openModal = showScheduleModal(description, [], id, currentFilters);
                return;
            }
            
            // загружаем расписание с API
            const schedule = await fetchSchedule(auditoriumNumber);
            document.body.removeChild(loadingModal);
            
            // модальное окно с учётом текущих фильтров
            openModal = showScheduleModal(description, schedule, id, currentFilters);
        } catch (error) {
            console.error('Ошибка:', error);
            if (loadingModal.parentNode) document.body.removeChild(loadingModal);
            openModal = showScheduleModal(description, [], id, currentFilters);
        }
    });
}

function populateFilterForm(options) {
    const fields = ['department', 'group', 'subgroup', 'teacher', 'lesson', 'type', 'parity'];
    const labels = {
        department: 'Факультет',
        group: 'Группа',
        subgroup: 'Подгруппа',
        teacher: 'Преподаватель',
        lesson: 'Предмет',
        type: 'Тип',
        parity: 'Чётность'
    };
    
    fields.forEach(field => {
        const select = document.getElementById(`filter-${field}`);
        if (!select) return;
        
        select.innerHTML = `<option value="">${labels[field]}</option>`;
        (options[field] || []).forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
        });
    });
}

// установка значений в фильтрах (берутся из расписания по этажу)
async function setupGlobalFilters(floor) {
    currentFloor = floor;
    
    const options = await loadFilterOptions(floor);
    populateFilterForm(options);
    
    const fields = ['department', 'group', 'subgroup', 'teacher', 'lesson', 'type', 'parity'];
    
    fields.forEach(field => {
        const select = document.getElementById(`filter-${field}`);
        if (select) {
            select.addEventListener('change', () => {
                const val = select.value;
                if (val) currentFilters[field] = val;
                else delete currentFilters[field];
                
                const applyBtn = document.getElementById('apply-filters');
                if (applyBtn) applyBtn.disabled = Object.keys(currentFilters).length === 0;
            });
        }
    });
    
    // кнопка "Применить" - пересоздаёт открытое модальное окно с новыми фильтрами
    document.getElementById('apply-filters')?.addEventListener('click', () => {
        if (openModal) {
            const id = openModal.id?.replace('schedule-modal-', '');
            const description = openModal.querySelector('h1')?.textContent?.replace('Расписание аудитории', '').trim();
            const cachedSchedule = scheduleCache.get(id) || [];
            
            document.body.removeChild(openModal);
            openModal = show_schedule(description, cachedSchedule, id, currentFilters);
        }
    });
    
    // кнопка "Сбросить" - очищает фильтры и закрывает модальное окно тут же
    document.getElementById('reset-filters')?.addEventListener('click', () => {
        currentFilters = {};
        fields.forEach(f => {
            const sel = document.getElementById(`filter-${f}`);
            if (sel) sel.value = '';
        });
        
        const applyBtn = document.getElementById('apply-filters');
        if (applyBtn) applyBtn.disabled = true;
        
        if (openModal) {
            document.body.removeChild(openModal);
            openModal = null;
        }
    });
}

function show_schedule(description, schedule, id, filters = {}) {
    const modal = document.createElement('div');
    modal.id = `schedule-modal-${id}`;
    modal.className = 'schedule-modal-wrapper';
    
    const filteredSchedule = filterSchedule(schedule, filters);
    let contentHTML = '';
    
    if (!schedule || schedule.length === 0) {
        contentHTML = `
            <div class="modal-content">
                <h1>Расписание аудитории<br>${description}</h1>
                <p>Для данного объекта нет расписания</p>
            </div>
        `;
    }
    else if (filteredSchedule.length === 0) {
        contentHTML = `
            <div class="modal-content">
                <h1>Расписание аудитории<br>${description}</h1>
                <p>Пары с такими фильтрами отсутствуют</p>
            </div>
        `;
    }
    else {
        let tablesHTML = '';
        const scheduleByDay = {};
        filteredSchedule.forEach(item => {
            if (!scheduleByDay[item.day]) scheduleByDay[item.day] = [];
            scheduleByDay[item.day].push(item);
        });
        
        for (const day in scheduleByDay) {
            tablesHTML += `
                <div>
                    <h1>${day}</h1>
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>№</th>
                                    <th>Факультет</th>
                                    <th>Группа</th>
                                    <th>Подгруппа</th>
                                    <th>Преподаватель</th>
                                    <th>Пара</th>
                                    <th>Тип</th>
                                    <th>Чётность</th>
                                    <th>Комментарий</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${scheduleByDay[day].map(item => `
                                    <tr>
                                        <td>${item.number}</td>
                                        <td>${Array.isArray(item.department) ? item.department.join('<br>') : (item.department || '')}</td>
                                        <td>${Array.isArray(item.group) ? item.group.join(', ') : (item.group || '')}</td>
                                        <td>${item.subgroup || 'Вся группа'}</td>
                                        <td>${item.teacher}</td>
                                        <td>${item.lesson}</td>
                                        <td>${item.type}</td>
                                        <td>${item.parity}</td>
                                        <td class="comment-cell">${item.comment || ''}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
        
        contentHTML = `
            <div class="modal-content">
                <h1>Расписание аудитории<br>${description}</h1>
                ${tablesHTML}
            </div>
        `;
    }
    
    modal.innerHTML = contentHTML;
    document.body.appendChild(modal);
    return modal;
}

export {
    create_map,
    create_popup,
    pointermove,
    click,
    polygonFeatures,
    template_polygon_feature,
    defaultStyle,
    highlightStyle,
    imageWidth,
    imageHeight,
    imageExtent,
    proj,
    vectorSource,
    show_schedule,
    vectorLayer,
    openModal,
    setupGlobalFilters
};