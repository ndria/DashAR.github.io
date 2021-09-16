/* global AFRAME */
if (typeof AFRAME === 'undefined') {
    throw new Error('Component attempted to register before AFRAME was available.');
}

/**
 * A-Charts component for A-Frame.
 */
AFRAME.registerComponent('charts', {
    schema: {
        type:                 {type: 'string', default: 'bubble'},
        dataPoints:           {type: 'asset'},
        axis_visible:         {type: 'boolean', default: true},
        axis_position:        {type: 'vec3', default: {x:0, y:0, z:0}},
        axis_color:           {type: 'string', default: 'red'},
        axis_length:          {type: 'number', default: 0},
        axis_tick_separation: {type: 'number', default: 1},
        axis_tick_length:     {type: 'number', default: 0.2},
        axis_tick_color:      {type: 'string', default: 'red'},
        axis_negative:        {type: 'boolean', default: true},
        axis_grid:            {type: 'boolean', default: false},
        axis_grid_3D:         {type: 'boolean', default: false},
        axis_text:            {type: 'boolean', default: true},
        axis_text_color:      {type: 'string', default: 'white'},
        axis_text_size:       {type: 'number', default: 10},
        pie_radius:           {type: 'number', default: 1},
        pie_doughnut:         {type: 'boolean', default: false},
        show_popup_info:      {type: 'boolean', default: false},
        show_legend_info:     {type: 'boolean', default: false},
        show_legend_position: {type: 'vec3', default: {x:0, y:0, z:0}},
        show_legend_rotation: {type: 'vec3', default: {x:0, y:0, z:0}},
        show_legend_title:    {type: 'string', default: 'Legend'},
        entity_id_list:       {type: 'string', default: ''},
        dataPoints_list:      {type: 'string', default: ''}
    },

    /**
    * Set if component needs multiple instancing.
    */
    multiple: false,

    /**
    * Called once when component is attached. Generally for initial setup.
    */
    init: function () {
        this.loader = new THREE.FileLoader();
    },

    /**
    * Called when component is attached and when component data changes.
    * Generally modifies the entity based on the data.
    */

    update: function (oldData) {
        const data = this.data;
        if (data.dataPoints && data.dataPoints !== oldData.dataPoints) {
            while (this.el.firstChild)
                this.el.firstChild.remove();
        }
        if(data.dataPoints) {
            if (data.dataPoints.constructor === ([{}]).constructor) {
                this.onDataLoaded(this, data.dataPoints, true);
            }else if(data.dataPoints.constructor === "".constructor){
                try{
                    this.onDataLoaded(this, JSON.parse(data.dataPoints), true);
                }catch(e) {
                    this.loader.load(data.dataPoints, this.onDataLoaded.bind(this, false));
                }
            }
        }else if(data.type === "totem"){
            generateTotem(data, this.el);
        }
    },
    /**
    * Called when a component is removed (e.g., via removeAttribute).
    * Generally undoes all modifications to the entity.
    */
    remove: function () { },

    /**
    * Called on each scene tick.
    */
    // tick: function (t) { },

    /**
    * Called when entity pauses.
    * Use to stop or remove any dynamic or background behavior such as events.
    */
    pause: function () { },

    /**
    * Called when entity resumes.
    * Use to continue or add any dynamic or background behavior such as events.
    */
    play: function () { },

    onDataLoaded: function (isJson, file) {
        let dataPoints = file;
        try{
            if(!isJson)
                dataPoints = JSON.parse(file);
        }catch(e) {
            throw new Error('Can\'t parse JSON file. Maybe is not a valid JSON file');
        }

        const properties = this.data;
        let element = this.el;

        startAxisGeneration(element, properties, dataPoints);

        // Legend and pop Up
        let popUp;
        let show_popup_condition = properties.show_popup_info && properties.type !== "pie" && !properties.pie_doughnut;
        let show_legend_condition = properties.show_legend_info;
        let legend_title;
        let legend_sel_text;
        let legend_all_text;
        let legend_properties;

        if(show_legend_condition && dataPoints.length > 0){
            legend_properties = getLegendProperties(dataPoints, properties, element);
            legend_title = generateLegendTitle(legend_properties);
            legend_sel_text = generateLegendSelText(legend_properties, dataPoints[0], properties);
            legend_all_text = generateLegendAllText(legend_properties, getLegendText(dataPoints, dataPoints[0], properties));
            element.appendChild(legend_title);
            element.appendChild(legend_sel_text);
            element.appendChild(legend_all_text);
        }

        // Properties for Pie Chart
        let pie_angle_start = 0;
        let pie_angle_end = 0;
        let pie_total_value = 0;

        if(properties.type === "pie"){
            for (let point of dataPoints) {
                pie_total_value += point['size'];
            }
        }

        //Chart generation
        for (let point of dataPoints) {
            let entity;
            if(properties.type === "bar"){
                entity = generateBar(point);
            }else if(properties.type === "cylinder"){
                entity = generateCylinder(point);
            }else if(properties.type === "pie"){
                pie_angle_end = 360 * point['size'] / pie_total_value;
                if(properties.pie_doughnut){
                    entity = generateDoughnutSlice(point, pie_angle_start, pie_angle_end, properties.pie_radius);
                }else{
                    entity = generateSlice(point, pie_angle_start, pie_angle_end, properties.pie_radius);
                }
                pie_angle_start += pie_angle_end;
            }else{
                entity = generateBubble(point);
            }

            entity.addEventListener('mouseenter', function () {
                this.setAttribute('scale', {x: 1.3, y: 1.3, z: 1.3});
                if(show_popup_condition){
                    popUp = generatePopUp(point, properties);
                    element.appendChild(popUp);
                }
                if(!show_legend_condition)
                    return;
                element.removeChild(legend_sel_text);
                element.removeChild(legend_all_text);
                legend_sel_text = generateLegendSelText(legend_properties, point, properties);
                legend_all_text = generateLegendAllText(legend_properties, getLegendText(dataPoints, point, properties));
                element.appendChild(legend_sel_text);
                element.appendChild(legend_all_text);
            });

            entity.addEventListener('mouseleave', function () {
                this.setAttribute('scale', {x: 1, y: 1, z: 1});
                if(show_popup_condition){
                    element.removeChild(popUp);
                }
            });

            element.appendChild(entity);
        }
    }
});

function getPosition (element){
    let position = {x:0, y:0, z:0};
    if(element.attributes.position == null)
        return position;

    let myPos = element.attributes.position.value.split(" ");
    if(myPos[0] !== "" && myPos[0] != null)
        position['x'] = myPos[0];
    if(myPos[1] !== "" && myPos[1] != null)
        position['y'] = myPos[1];
    if(myPos[2] !== "" && myPos[2] != null)
        position['z'] = myPos[2];
    return position;
}

function getRotation (element){
    let rotation = {x:0, y:0, z:0};
    if(element.attributes.rotation == null )
        return rotation;
    let myPos = element.attributes.rotation.value.split(" ");
    if(myPos[0] !== "" && myPos[0] != null)
        rotation['x'] = myPos[0];
    if(myPos[1] !== "" && myPos[1] != null)
        rotation['y'] = myPos[1];
    if(myPos[2] !== "" && myPos[2] != null)
        rotation['z'] = myPos[2];
    return rotation;
}

function generatePopUp(point, properties) {
    let correction = 0;
    if(properties.type === "bar" || properties.type === "cylinder")
        correction = point['size']/2;

    let text = point['label'] + ': ' + point['y'];

    let width = 2;
    if(text.length > 16)
        width = text.length/8;

    let entity = document.createElement('a-plane');
    entity.setAttribute('position', {x: point['x'] + correction, y: point['y'] + 3 , z: point['z']});
    entity.setAttribute('height', '2');
    entity.setAttribute('width', width);
    entity.setAttribute('color', 'white');
    entity.setAttribute('text', {
        'value': 'DataPoint:\n\n' + text,
        'align': 'center',
        'width': 6,
        'color': 'black'
    });
    entity.setAttribute('light', {
        'intensity': 0.3
    });
    return entity;
}

function getLegendProperties(dataPoints, properties, element){
    let height = 2;
    if(dataPoints.length - 1 > 6)
        height = (dataPoints.length - 1) / 3;

    let max_width_text = properties.show_legend_title.length;
    for(let point of dataPoints){
        let point_text = point['label'] + ': ';
        if(properties.type === 'pie'){
            point_text += point['size'];
        }else{
            point_text += point['y'];
        }
        if(point_text.length > max_width_text)
            max_width_text = point_text.length;
    }

    let width = 2;
    if(max_width_text > 9)
        width = max_width_text / 4.4;

    let chart_position = getPosition(element);
    let position_tit =      {x: properties.show_legend_position.x - chart_position.x, y: properties.show_legend_position.y - chart_position.y + (height/2) + 0.5, z: properties.show_legend_position.z - chart_position.z};
    let position_sel_text = {x: properties.show_legend_position.x - chart_position.x, y: properties.show_legend_position.y - chart_position.y + (height/2),       z: properties.show_legend_position.z - chart_position.z};
    let position_all_text = {x: properties.show_legend_position.x - chart_position.x, y: properties.show_legend_position.y - chart_position.y,                    z: properties.show_legend_position.z - chart_position.z};

    let chart_rotation = getRotation(element);
    let rotation = {x: properties.show_legend_rotation.x - chart_rotation.x, y: properties.show_legend_rotation.y - chart_rotation.y, z: properties.show_legend_rotation.z - chart_rotation.z};

    return {height: height, width: width, title: properties.show_legend_title, rotation: rotation, position_tit: position_tit, position_sel_text: position_sel_text, position_all_text: position_all_text}
}

function getLegendText(dataPoints, point, properties) {
    let text = "";

    let auxDataPoints = dataPoints.slice();
    let index = auxDataPoints.indexOf(point);
    auxDataPoints.splice(index, 1);

    for(let i = 0; i < auxDataPoints.length; i++){
        if(properties.type === 'pie'){
            text += auxDataPoints[i]['label'] + ': ' + auxDataPoints[i]['size'];
        }else{
            text += auxDataPoints[i]['label'] + ': ' + auxDataPoints[i]['y'];
        }
        if(i !== auxDataPoints.length -1 )
            text += "\n";
    }

    return text;
}

function generateLegendTitle(legendProperties) {
    let entity = document.createElement('a-plane');
    entity.setAttribute('position', legendProperties.position_tit);
    entity.setAttribute('rotation', legendProperties.rotation);
    entity.setAttribute('height', '0.5');
    entity.setAttribute('width', legendProperties.width);
    entity.setAttribute('color', 'white');
    entity.setAttribute('text__title', {
        'value': legendProperties.title,
        'align': 'center',
        'width': '8',
        'color': 'black'
    });
    return entity;
}

function generateLegendSelText(legendProperties, point, properties) {
    let value = "";
    if(properties.type === 'pie'){
        value =  point['size'];
    }else{
        value =  point['y'];
    }

    let entity = document.createElement('a-plane');
    entity.setAttribute('position', legendProperties.position_sel_text);
    entity.setAttribute('rotation', legendProperties.rotation);
    entity.setAttribute('height', '0.5');
    entity.setAttribute('width', legendProperties.width);
    entity.setAttribute('color', 'white');
    entity.setAttribute('text__title', {
        'value': point['label'] + ': ' + value,
        'align': 'center',
        'width': '7',
        'color': point['color']
    });
    entity.setAttribute('light', {
        'intensity': '0.3'
    });
    return entity;
}

function generateLegendAllText(legendProperties, text) {
    let entity = document.createElement('a-plane');
    entity.setAttribute('position', legendProperties.position_all_text);
    entity.setAttribute('rotation', legendProperties.rotation);
    entity.setAttribute('height', legendProperties.height);
    entity.setAttribute('width', legendProperties.width);
    entity.setAttribute('color', 'white');
    entity.setAttribute('text__title', {
        'value': text,
        'align': 'center',
        'width': '6',
        'color': 'black'
    });
    entity.setAttribute('light', {
        'intensity': '0.3'
    });
    return entity;
}

function generateSlice(point, theta_start, theta_length, radius) {
    let entity = document.createElement('a-cylinder');
    entity.setAttribute('color', point['color']);
    entity.setAttribute('theta-start', theta_start);
    entity.setAttribute('theta-length', theta_length);
    entity.setAttribute('side', 'double');
    entity.setAttribute('radius', radius);
    return entity;
}

function generateDoughnutSlice(point, position_start, arc, radius) {
    let entity = document.createElement('a-torus');
    entity.setAttribute('color', point['color']);
    entity.setAttribute('rotation', {x: 90, y: 0, z: position_start});
    entity.setAttribute('arc', arc);
    entity.setAttribute('side', 'double');
    entity.setAttribute('radius', radius);
    entity.setAttribute('radius-tubular', radius/4);
    return entity;
}

function generateBubble(point) {
    let entity = document.createElement('a-sphere');
    entity.setAttribute('position', {x: point['x'], y: point['y'], z: point['z']});
    entity.setAttribute('color', point['color']);
    entity.setAttribute('radius', point['size']);
    return entity;
}

function generateBar(point) {
    let entity = document.createElement('a-box');
    entity.setAttribute('position', {x: point['x'] + point['size']/2, y: point['y']/2, z: point['z']}); //centering graph
    entity.setAttribute('color', point['color']);
    entity.setAttribute('height', point['y']);
    entity.setAttribute('depth', point['size']);
    entity.setAttribute('width', point['size']);
    return entity;
}

function generateCylinder(point) {
    let entity = document.createElement('a-cylinder');
    entity.setAttribute('position', {x: point['x'] + point['size']/2, y: point['y']/2, z: point['z']}); //centering graph
    entity.setAttribute('color', point['color']);
    entity.setAttribute('height', point['y']);
    entity.setAttribute('radius', point['size'] / 2 );
    return entity;
}

function generateTotemTitle(width, position) {
    let entity = document.createElement('a-plane');
    entity.setAttribute('position', position);
    entity.setAttribute('scale', {x:1, y:1, z:0.01});
    entity.setAttribute('height', '0.5');
    entity.setAttribute('color', 'blue');
    entity.setAttribute('width', width);
    entity.setAttribute('text__title', {
        'value': 'Select dataSource:',
        'align': 'center',
        'width': '9',
        'color': 'white'
    });
    return entity;
}

function generateTotemSlice(properties, entity_id_list, dataPoints_path) {
    let entity = document.createElement('a-plane');
    entity.setAttribute('position', properties.position);
    entity.setAttribute('scale', {x:1, y:1, z:0.01});
    entity.setAttribute('height', '0.5');
    entity.setAttribute('width', properties.width);
    entity.setAttribute('text__title', {
        'value': properties.name,
        'align': 'center',
        'width': '8',
        'color': 'black'
    });

    entity.addEventListener('click', function () {
        let entity_list = entity_id_list.split(',');
        for(let id of entity_list){
            let myChart = document.getElementById(id);
            let data = myChart.getAttribute("charts");
            data.dataPoints = dataPoints_path;
            myChart.setAttribute('charts', data);
        }
    });
    return entity;
}

function getTotemWidth(dataPoints_list) {
    let max_width = "Select dataSource:".length;
    for(let name in dataPoints_list){
        if(name.length > max_width)
            max_width = name.length;
    }

    let width = 2;
    if(max_width > 9)
        width = max_width / 4.4;
    return width;
}

function generateTotem(properties, element) {
    if(properties.dataPoints_list === '')
        return;

    let dataPoints_list = properties.dataPoints_list.constructor === ({}).constructor ? properties.dataPoints_list : JSON.parse(properties.dataPoints_list.replace(/'/g, '"'));
    let position = getPosition(element);
    let width = getTotemWidth(dataPoints_list);
    element.appendChild(generateTotemTitle(width, position));
    let offset = 0.75;
    for(let myDataPoints in dataPoints_list){
        let dataProperties = {};
        dataProperties['position'] = {x: position.x, y: parseInt(position.y) - offset, z: position.z};
        dataProperties['name'] = myDataPoints;
        dataProperties['width'] = width;
        element.appendChild(generateTotemSlice(dataProperties, properties.entity_id_list, dataPoints_list[myDataPoints]));
        offset += 0.65;
    }

}

function startAxisGeneration(element, properties, dataPoints) {
    if(!properties.axis_visible || properties.type === "pie")
        return;

    if(properties.axis_length === 0){
        let adaptive_props = getAdaptiveAxisProperties(dataPoints);
        properties.axis_length = adaptive_props.max;
        if(properties.axis_negative)
            properties.axis_negative = adaptive_props.has_negative;
    }

    if(properties.axis_grid || properties.axis_grid_3D){
        generateGridAxis(element, properties);
    }else{
        generateAxis(element, properties);
    }
}

function generateAxis(element, properties) {
    let axis_length = properties.axis_length;
    let axis_position = properties.axis_position;
    let axis_color = properties.axis_color;

    let tick_separation = properties.axis_tick_separation;
    let tick_length = properties.axis_tick_length;
    let tick_color = properties.axis_tick_color;

    let axis_negative = properties.axis_negative;
    let axis_negative_offset = 0;

    let axis_text = properties.axis_text;
    let axis_text_color = properties.axis_text_color;
    let axis_text_size = properties.axis_text_size;

    for (let axis of ['x', 'y', 'z']) {

        let line_end = {x: axis_position.x, y: axis_position.y, z: axis_position.z};
        line_end[axis] = axis_length + axis_position[axis];

        let line_start = {x: axis_position.x, y: axis_position.y, z: axis_position.z};

        if (axis_negative){
            axis_negative_offset = axis_length + 1;
            line_start[axis] = -axis_length + axis_position[axis];
        }

        let axis_line = document.createElement('a-entity');
        axis_line.setAttribute('line__' + axis, {
            'start': line_start,
            'end':   line_end,
            'color': axis_color
        });


        for (let tick = tick_separation - axis_negative_offset; tick <= axis_length; tick += tick_separation) {
            let tick_start;
            let tick_end;

            if (axis === 'x') {
                tick_start = {x: axis_position.x + tick,         y: axis_position.y - tick_length,  z: axis_position.z};
                tick_end   = {x: axis_position.x + tick,         y: axis_position.y + tick_length,  z: axis_position.z};
            }else if (axis === 'y') {
                tick_start = {x: axis_position.x,                y: axis_position.y + tick,         z: axis_position.z - tick_length};
                tick_end   = {x: axis_position.x,                y: axis_position.y + tick,         z: axis_position.z + tick_length};
            }else{
                tick_start = {x: axis_position.x - tick_length,  y: axis_position.y,                z: axis_position.z + tick};
                tick_end   = {x: axis_position.x + tick_length,  y: axis_position.y,                z: axis_position.z + tick};
            }

            axis_line.setAttribute('line__' + axis + tick, {
                'start': tick_start,
                'end':   tick_end,
                'color': tick_color
            });


            if(axis_text){
                let axis_text = document.createElement('a-text');
                axis_text.setAttribute('position', tick_start);

                if (axis === 'x') {
                    axis_text.setAttribute('text__' + axis + tick, {
                        'value': Math.round(tick * 100) / 100,
                        'width': axis_text_size,
                        'color': axis_text_color,
                        'xOffset': 5
                    });
                }else if (axis === 'y') {
                    axis_text.setAttribute('text__' + axis + tick, {
                        'value': Math.round(tick * 100) / 100,
                        'width': axis_text_size,
                        'color': axis_text_color,
                        'xOffset': 4
                    });
                }else{
                    axis_text.setAttribute('text__' + axis + tick, {
                        'value': Math.round(tick * 100) / 100,
                        'width': axis_text_size,
                        'color': axis_text_color,
                        'xOffset': 4.5
                    });
                }

                element.appendChild(axis_text);
            }

        }
        element.appendChild(axis_line);
    }
}

function generateGridAxis(element, properties) {
    let axis_length = properties.axis_length;
    let axis_position = properties.axis_position;
    let axis_color = properties.axis_color;

    let axis_negative = properties.axis_negative;
    let axis_negative_offset = 0;
    let axis_negative_limit = 0;
    let axis_grid_3D = properties.axis_grid_3D;

    let axis_text = properties.axis_text;
    let axis_text_color = properties.axis_text_color;
    let axis_text_size = properties.axis_text_size;

    for (let axis of ['x', 'y', 'z']) {

        let line_end = {x: axis_position.x, y: axis_position.y, z: axis_position.z};
        line_end[axis] = axis_length + axis_position[axis];

        let line_start = {x: axis_position.x, y: axis_position.y, z: axis_position.z};

        if (axis_negative){
            axis_negative_offset = axis_length;
            axis_negative_limit = axis_length + 1;
            line_start[axis] = - axis_length + axis_position[axis];
        }

        let axis_line = document.createElement('a-entity');
        axis_line.setAttribute('line__' + axis, {
            'start': line_start,
            'end':   line_end,
            'color': axis_color
        });

        for (let tick = 1 - axis_negative_limit; tick <= axis_length; tick ++) {
            let tick_start;
            let tick_end;
            let grid_start;
            let grid_end;

            if (axis === 'x') {
                tick_start = {x: axis_position.x + tick,                  y: axis_position.y - axis_negative_offset,  z: axis_position.z};
                tick_end   = {x: axis_position.x + tick,                  y: axis_position.y + axis_length,           z: axis_position.z};
                grid_start = {x: axis_position.x + tick,                  y: axis_position.y,                         z: axis_position.z - axis_negative_offset};
                grid_end   = {x: axis_position.x + tick,                  y: axis_position.y,                         z: axis_position.z + axis_length};
            }else if (axis === 'y') {
                tick_start = {x: axis_position.x,                         y: axis_position.y + tick,                  z: axis_position.z - axis_negative_offset};
                tick_end   = {x: axis_position.x,                         y: axis_position.y + tick,                  z: axis_position.z + axis_length};
                grid_start = {x: axis_position.x - axis_negative_offset,  y: axis_position.y + tick,                  z: axis_position.z};
                grid_end   = {x: axis_position.x + axis_length,           y: axis_position.y + tick,                  z: axis_position.z};
            }else{
                tick_start = {x: axis_position.x - axis_negative_offset,  y: axis_position.y,                         z: axis_position.z + tick};
                tick_end   = {x: axis_position.x + axis_length,           y: axis_position.y,                         z: axis_position.z + tick};
                grid_start = {x: axis_position.x,                         y: axis_position.y - axis_negative_offset,  z: axis_position.z + tick};
                grid_end   = {x: axis_position.x,                         y: axis_position.y + axis_length,           z: axis_position.z + tick};
            }

            if(axis_text){
                let axis_text = document.createElement('a-text');
                axis_text.setAttribute('position', tick_end);

                if (axis === 'x') {
                    axis_text.setAttribute('text__' + axis + tick, {
                        'value': Math.round(tick * 100) / 100,
                        'width': axis_text_size,
                        'color': axis_text_color,
                        'xOffset': 5
                    });
                }else if (axis === 'y') {
                    axis_text.setAttribute('text__' + axis + tick, {
                        'value': Math.round(tick * 100) / 100,
                        'width': axis_text_size,
                        'color': axis_text_color,
                        'xOffset': 4
                    });
                }else{
                    axis_text.setAttribute('text__' + axis + tick, {
                        'value': Math.round(tick * 100) / 100,
                        'width': axis_text_size,
                        'color': axis_text_color,
                        'xOffset': 4.5
                    });
                }

                element.appendChild(axis_text);
            }

            axis_line.setAttribute('line__' + axis + tick, {
                'start': tick_start,
                'end':   tick_end,
                'color': axis_color
            });

            axis_line.setAttribute('line__' + axis + tick + axis_length, {
                'start': grid_start,
                'end':   grid_end,
                'color': axis_color
            });

            if(!axis_grid_3D)
                continue;
            for (let grid = 1 - axis_negative_offset; grid <= axis_length; grid ++) {
                let sub_grid_start;
                let sub_grid_end;

                if (axis === 'x') {
                    sub_grid_start = {x: axis_position.x + tick,                  y: axis_position.y - axis_negative_offset,  z: axis_position.z + grid};
                    sub_grid_end   = {x: axis_position.x + tick,                  y: axis_position.y + axis_length,           z: axis_position.z + grid};
                }else if (axis === 'y') {
                    sub_grid_start = {x: axis_position.x + grid,                  y: axis_position.y + tick,                  z: axis_position.z - axis_negative_offset};
                    sub_grid_end   = {x: axis_position.x + grid,                  y: axis_position.y + tick,                  z: axis_position.z + axis_length};
                }else{
                    sub_grid_start = {x: axis_position.x - axis_negative_offset,  y: axis_position.y + grid,                  z: axis_position.z + tick};
                    sub_grid_end   = {x: axis_position.x + axis_length,           y: axis_position.y + grid,                  z: axis_position.z + tick};
                }

                axis_line.setAttribute('line__' + axis + tick + grid + axis_length, {
                    'start': sub_grid_start,
                    'end':   sub_grid_end,
                    'color': axis_color
                });
            }


        }
        element.appendChild(axis_line);
    }
}

function getAdaptiveAxisProperties(dataPoints) {
    let max = 0;
    let has_negative = false;

    for (let point of dataPoints) {
        if(point.x < 0 || point.y < 0 || point.z < 0)
            has_negative = true;

        let point_x = Math.abs(point.x);
        let point_y = Math.abs(point.y);
        let point_z = Math.abs(point.z);

        if( point_x > max)
            max = point_x;
        if( point_y > max)
            max = point_y;
        if( point_z > max)
            max = point_z;
    }

    return {max: max, has_negative: has_negative};
}