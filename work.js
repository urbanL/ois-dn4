var baseUrl = 'https://rest.ehrscape.com/rest/v1';
var queryUrl = baseUrl + '/query';

var username = "ois.seminar";
var password = "ois4fri";

function getSession() {
    var response = $.ajax({
        type: "POST",
        url: baseUrl + "/session?username=" + encodeURIComponent(username) +
        "&password=" + encodeURIComponent(password),
        async: false
    });
    return response.responseJSON.sessionId;
}

function checkInput(input) {
    if (input == '') {
        return true;
    }

    if (!input) {
        return true;
    }

    if (input.trim().length == 0) {
        return true;
    }

    return false;
}

function checkNumericInput(input) {
    console.log(input);
    if (input == '') {
        return true;
    }
    return isNaN(input);
}


function dodajBolnika() {
    session = getSession();

    var ime = $("#dodajIme").val();
    var priimek = $("#dodajPriimek").val();
    var datum = $("#dodajDatumRojstva").val();

    if (checkInput(ime) || checkInput(priimek) || checkInput(datum)) {
        alert("Prosim pravilno vnesite zahtevane podatke!");
    } else {
        $.ajaxSetup({
            headers: {"Ehr-Session": session}
        });
        $.ajax({
            url: baseUrl + "/ehr",
            type: 'POST',
            success: function (data) {
                var ehrId = data.ehrId;
                var partyData = {
                    firstNames: ime,
                    lastNames: priimek,
                    dateOfBirth: datum,
                    partyAdditionalInfo: [{key: "ehrId", value: ehrId}]
                };
                $.ajax({
                    url: baseUrl + "/demographics/party",
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify(partyData),
                    success: function (party) {
                        if (party.action == 'CREATE') {
                            alert("Kreiran EHR '" + ehrId + "'.");
                        }
                    },
                    error: function (err) {
                        alert("Napaka '" + JSON.parse(err.responseText).userMessage + "'!");
                    }
                });
            }
        });
    }
}

function dodajZapis() {
    session = getSession();

    $("#rezultatMeh").hide();
    $("#rezultatError").hide();
    $("#rezultatOk").hide();

    var visina = $("#dodajVisino").val();
    var teza = $("#dodajTezo").val();
    var id = $("#dodajUporabnik").val();
    var datum = $("#dodajDatum").val();

    if (checkInput(id) || checkInput(datum) || checkNumericInput(visina) || checkNumericInput(teza)) {
        alert("Prosim pravilno vnesite zahtevane podatke!");
    } else {
        $.ajaxSetup({
            headers: {"Ehr-Session": session}
        });
        var podatki = {
            "ctx/language": "en",
            "ctx/territory": "SI",
            "ctx/time": datum,
            "vital_signs/height_length/any_event/body_height_length": visina,
            "vital_signs/body_weight/any_event/body_weight": teza
        };
        var parametriZahteve = {
            "ehrId": id,
            templateId: 'Vital Signs',
            format: 'FLAT',
            commiter: 'ITM Orodje'
        };
        $.ajax({
            url: baseUrl + "/composition?" + $.param(parametriZahteve),
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(podatki),
            success: function (res) {
                console.log(res.meta.href);
                var res = teza * 10000 / (visina * visina);
                if (res < 18.5) {
                    $('#rezultatMeh').show().html("Zapis dodan. ITM je  <b>" + res.toFixed(1) + "</b> kar nakazuje podhranjenost.");
                } else if (res <= 25) {
                    $("#rezultatOk").show().html("Zapis dodan. ITM je <b>" + res.toFixed(1) + "</b> kar je popolnoma normalno.");
                } else if (res < 30) {
                    $("#rezultatMeh").show().html("Zapis dodan. ITM je <b>" + res.toFixed(1) + "</b> kar nakazuje prekomerno tezo.");
                } else {
                    $("#rezultatError").show().html("Zapis dodan. ITM je <b>" + res.toFixed(1) + "</b> kar nakazuje debelost, dobro bi bilo obiskati zdravnika.");
                }
            },
            error: function (err) {
                alert("Napaka " + JSON.parse(err.responseText).userMessage);
            }
        });
    }
}

function preberiPodatke() {
    session = getSession();
    console.log("this");
    var id = $("#preberiUporabnik").val();

    if (checkInput(id)) {
        alert("Prosim vnesite veljavne podatke.");
    } else {
        $.ajax({
            url: baseUrl + "/demographics/ehr/" + id + "/party",
            type: 'GET',
            headers: {"Ehr-Session": session},
            success: function (data) {
                var AQL =
                    "select " +
                    "a_a/data[at0001]/origin as date, " +
                    "a_b/data[at0002]/events[at0003]/data[at0001]/items[at0004, 'Body weight']/value as Body_weight, " +
                    "a_a/data[at0001]/events[at0002]/data[at0003]/items[at0004, 'Body Height/Length']/value as Body_Height_Length " +
                    "from EHR e[e/ehr_id/value='" + id + "'] " +
                    "contains COMPOSITION a " +
                    "contains ( " +
                    "OBSERVATION a_a[openEHR-EHR-OBSERVATION.height.v1] and " +
                    "OBSERVATION a_b[openEHR-EHR-OBSERVATION.body_weight.v1]) " +
                    "order by a_a/data[at0001]/origin/value desc " +
                    "offset 0 limit 100";
                console.log(AQL);
                $.ajax({
                    url: baseUrl + "/query?" + $.param({"aql": AQL}),
                    type: 'GET',
                    headers: {"Ehr-Session": session},
                    success: function (res) {
                        console.log(res);
                        var rows = res.resultSet;
                        preberiPodatke2(rows);


                    },
                    error: function (err) {
                        alert("Napaka '" + JSON.parse(err.responseText).userMessage + "'!");
                    }
                });
            },
            error: function (err) {
                alert("Napaka '" + JSON.parse(err.responseText).userMessage + "'!");
            }
        });
    }
}

function preberiPodatke2(data) {
    var margin = {top: 20, right: 20, bottom: 30, left: 50},
        width = $(".divbody").width() - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;
    var parseDate = d3.time.format("%Y-%m-%d").parse;
    var x = d3.time.scale()
        .range([0, width]);
    var y = d3.scale.linear()
        .range([height, 0]);
    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");
    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");
    var line = d3.svg.line()
        .x(function (d) {
            return x(d.date.value);
        })
        .y(function (d) {
            return y(d.Body_weight.magnitude);
        });
    $(".divbody").empty();
    var svg = d3.select(".divbody").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    data.forEach(function (d) {
        d.date.value = parseDate(sanitizeDate(d.date.value));
        d.Body_weight.magnitude = d.Body_weight.magnitude * 10000 / (d.Body_Height_Length.magnitude * d.Body_Height_Length.magnitude);
    });
    x.domain(d3.extent(data, function (d) {
        return d.date.value;
    }));
    y.domain(d3.extent(data, function (d) {
        return d.Body_weight.magnitude;
    }));
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);
    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("ITM");
    svg.append("path")
        .datum(data)
        .attr("class", "line")
        .attr("d", line);

}

function sanitizeDate(date) {
    var i = date.indexOf("T");
    return date.substring(0, i);
}

function fill1() {
    $("#dodajIme").val("Janez");
    $("#dodajPriimek").val("Novak");
    $("#dodajDatumRojstva").val("1994-05-12");
    $("#dodajUporabnik").val("6132d321-cad3-461b-95b8-cd5662842d87");
    $("#dodajDatum").val("2015-05-05");
    $("#dodajTezo").val("80");
    $("#dodajVisino").val("190");
    $("#preberiUporabnik").val("6132d321-cad3-461b-95b8-cd5662842d87");
}

function fill2() {
    $("#dodajIme").val("Valkoslav");
    $("#dodajPriimek").val("Pivopivec");
    $("#dodajDatumRojstva").val("1945-09-02");
    $("#dodajUporabnik").val("432d5581-72e3-4d6b-88f1-3fc2a2b5d920");
    $("#dodajDatum").val("1960-05-18");
    $("#dodajTezo").val("70");
    $("#dodajVisino").val("175");
    $("#preberiUporabnik").val("432d5581-72e3-4d6b-88f1-3fc2a2b5d920");
}

function fill3() {
    $("#dodajIme").val("Petardo");
    $("#dodajPriimek").val("Mauriti");
    $("#dodajDatumRojstva").val("1975-10-13");
    $("#dodajUporabnik").val("4e900e83-d12b-42a4-b751-5202545436b2");
    $("#dodajDatum").val("1991-06-01");
    $("#dodajTezo").val("75");
    $("#dodajVisino").val("190");
    $("#preberiUporabnik").val("4e900e83-d12b-42a4-b751-5202545436b2");
}