import {
  createMap,
  createPopup,
  pointermove,
  click,
  polygonFeatures,
  templatePolygonFeature,
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
  setupGlobalFilters,
} from '/index.js';

// лестницы
templatePolygonFeature(
  [
    [
      [1480, 1061],
      [1600, 1061],
      [1600, 979],
      [1480, 979],
      [1480, 1061],
    ],
  ],
  'центральная лестница',
  'centralstairs1',
);
templatePolygonFeature(
  [
    [
      [1604, 958],
      [1769, 958],
      [1769, 1088],
      [1604, 1088],
      [1604, 958],
    ],
  ],
  'центральная лестница',
  'centralstairs2',
);
templatePolygonFeature(
  [
    [
      [1773, 979],
      [1895, 979],
      [1895, 1061],
      [1773, 1061],
      [1773, 979],
    ],
  ],
  'центральная лестница',
  'centralstairs3',
);

templatePolygonFeature(
  [
    [
      [1558, 1203],
      [1815, 1203],
      [1815, 1435],
      [1558, 1435],
      [1558, 1203],
    ],
  ],
  '701 (лекционная аудитория)',
  '701',
);

const map = createMap('seventh_floor.svg');

const popup = createPopup();
map.addOverlay(popup);

pointermove(map, defaultStyle, highlightStyle, popup);
click(map, show_schedule);

setupGlobalFilters(7);
