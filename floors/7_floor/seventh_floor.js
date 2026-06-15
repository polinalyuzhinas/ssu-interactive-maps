import {
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
} from '/index.js';

const seventhFloorCoordinates = {
  "центральная лестница": [
    [[1480, 1061], [1600, 1061], [1600, 979], [1480, 979], [1480, 1061]],
    [[1604, 958], [1769, 958], [1769, 1088], [1604, 1088], [1604, 958]],
    [[1773, 979], [1895, 979], [1895, 1061], [1773, 1061], [1773, 979]]
  ],
  "701": [
    [[1558, 1203], [1815, 1203], [1815, 1435], [1558, 1435], [1558, 1203]]
  ]
};

// лестницы
template_polygon_feature([[[1480, 1061],[1600, 1061],[1600, 979],[1480, 979],[1480, 1061]]], 'центральная лестница', 'centralstairs1');
template_polygon_feature([[[1604, 958],[1769, 958],[1769, 1088],[1604, 1088],[1604, 958]]], 'центральная лестница', 'centralstairs2');
template_polygon_feature([[[1773, 979],[1895, 979],[1895, 1061],[1773, 1061],[1773, 979]]], 'центральная лестница', 'centralstairs3');

template_polygon_feature([[[1558, 1203],[1815, 1203],[1815, 1435],[1558, 1435],[1558, 1203]]], '701 (лекционная аудитория)', '701');

const map = create_map('seventh_floor.svg');

const popup = create_popup();
map.addOverlay(popup);

pointermove(map, defaultStyle, highlightStyle, popup);
click(map, show_schedule);

setupGlobalFilters(7);