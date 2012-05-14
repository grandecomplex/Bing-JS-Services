var API_KEY = "ADD_API_KEY";
var MAP_ZOOM = 14;

function geoLocation(location, callback) {
    $.ajax({
       url: "http://dev.virtualearth.net/REST/v1/Locations/"+location,
       dataType: "jsonp",
       data: {
           key: API_KEY
       },
       jsonp: "jsonp",
       success: callback
    });
}

function initPins(pins, map) {
    var pinWrapper  = new Pins(map);
    return pinWrapper.add(pins);
}

function MapServices(success, failure) {
    var onLoadTimer;
    var timeOutTimer;
    
    if (typeof Microsoft === "undefined") {
        var script = document.createElement("script");
        script.type = "text/javascript";
        script.src = "http://ecn.dev.virtualearth.net/mapcontrol/mapcontrol.ashx?v=7.0";
        
        $(script)
        .error(function() {
            setTimeout(function() {
                failure();
            }, 1000);
        })
        .load(function() {
            setTimeout(function() {
                success();
            }, 1000);
        });
        
        document.body.appendChild(script);
    } else {
        if (success) {
            success();
        }
    }
}

MapServices.prototype.createMap = function(options, success, failure) {
    var that = this;
    
    var wrapper = document.getElementById(options.wrapper || "map");
    var latlong = [];
                    
    this.map = {};

    function callAPI(latlong) {
        if (!Microsoft.Maps.Map) {
            if (failure) {
                failure();
            }
            return;
        }
             
        that.map = new Microsoft.Maps.Map(wrapper, {
            credentials: API_KEY,
            center: new Microsoft.Maps.Location(latlong[0], latlong[1]),
            mapTypeId: Microsoft.Maps.MapTypeId.road,
            zoom: MAP_ZOOM,
            showMapTypeSelector: false,
            declutterPins: 1
        });
        

        that.map.pins = initPins({
            data: [{
                latitude: latlong[0],
                longitude: latlong[1]
            }],
            callback: function() {}
        }, that.map);

        
        console.log(that.map)

        if (success) {success(that.map);}
    }

    if (options.address) {
        geoLocation(options.address, function(data) {
            if (data.statusCode === 200 && data.resourceSets[0].resources.length) {
                latlong = data.resourceSets[0].resources[0].point.coordinates;
                callAPI(latlong);
            } 
        });
    } else {
        callAPI([options.latitude, options.longitude]);
    }
    
    return this;
};

MapServices.prototype.resetMapOptions = function(options, success, failure) {
    var that = this;

    function setMap(lat, long) {
        that.map.setView({
            zoom: MAP_ZOOM,
            center: new Microsoft.Maps.Location(options.latitude, options.longitude)
        });
        that.map.pins.clear();
        that.map.pins.add({
            data: [{
                latitude: options.latitude,
                longitude: options.longitude,
                callback: function() {}
            }]
        });
    }
    
    if (options.latitude && options.longitude) {
        setMap(options.latitude, options.longitude);
    } else if (options.address) {
        geoLocation(options.address, function(data) {
            if (data.statusCode === 200 && data.resourceSets[0].resources.length) {
                latlong = data.resourceSets[0].resources[0].point.coordinates;
                setMap(latLong[0], latLong[1]);
            }
        });
        success(that.map);
    }
    
    if (options.pins) {
        that.map.pins.clear();
        that.map.pins.add(options.pins);
    }
    
    return this;
};

MapServices.prototype.getPlaces = function(location, success, failure) {
    geoLocation(location, function(response) {
        var latlong;
        if (response.resourceSets[0].estimatedTotal === 0) {
            if (failure) { 
                return failure("noResults");
            }
        }
        
        latlong = response.resourceSets[0].resources[0].point.coordinates;

        $.ajax({
            url: "http://spatial.virtualearth.net/REST/v1/data/f22876ec257b474b82fe2ffcb8393150/NavteqNA/NavteqPOIs",
            dataType: "jsonp",
            data: {
                key: API_KEY,
                spatialFilter: "nearby("+latlong[0]+","+ latlong[1]+", 1)",
                $select: "EntityID,DisplayName,AddressLine,PostalCode,__Distance",
                $format: "json"
            },
            jsonp: "jsonp",
            success: function (data) {
                var places;
                if (data.d) {
                    places = data.d.results;
                    if (places) {
                        success(places);
                    }
                }
            }
        });
    });
};

var Pins = function(map) {
    this.map = map;
    this.pins = [];
};

Pins.prototype.add = function(pinsModel) {
    var that = this;
    pinsModel.data.forEach(function(pin, i) {                
        pin = new Microsoft.Maps.Pushpin(new Microsoft.Maps.Location(pin.latitude, pin.longitude), {draggable: false});
        Microsoft.Maps.Events.addHandler(pin, 'mouseup', function(e) {
            e.index = i;
            pinsModel.callback(e);
        });
        that.map.entities.push(pin);
        that.pins.push(pin);
    });

    return this;
};

Pins.prototype.clear = function(pins) {
    this.map.entities.clear();
    return this.map;
};

Pins.prototype.get = function() {
    return this.pins;
};

MapServices.infoBox = function(e, content, map) {
    var pin, infoboxLayer;
    
    if (this.pinInfobox) {
        this.pinInfobox.setOptions({visible:false});
    }

    if (e.targetType !== "pushpin") {throw "Unable to create pushpin";}

    pin = e.target;

    infoboxLayer = new Microsoft.Maps.EntityCollection();
    map.entities.push(infoboxLayer);

    // Create the info box for the pushpin
    this.pinInfobox = new Microsoft.Maps.Infobox(new Microsoft.Maps.Location(0,0), {visible: false});
    infoboxLayer.push(this.pinInfobox);

    this.pinInfobox.setOptions({
        visible:true,
        offset: new Microsoft.Maps.Point(0, 20),
        htmlContent: content
    });

    //set location of infobox
    this.pinInfobox.setLocation(pin.getLocation());
};
