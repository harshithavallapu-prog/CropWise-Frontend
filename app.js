
const API_BASE = "https://cropwise-deployment.onrender.com";
const $ = (s) => document.querySelector(s);
const classCounts = [
  ["Low",2649],["Severe",2465],["Waterlogging Risk",2265],["Moderate",1139],["High",666]
];
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800)}
function riskClass(v){return String(v||"").toLowerCase().replaceAll(" ","-")}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function showPage(id){document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===id));const titles={overview:["Good evening, field manager.","Monitor crop stress and allocate irrigation where it matters most."],fields:["Field irrigation priorities.","A ranked view of fields that may need attention."],predict:["Assess crop-stress risk.","Submit a field observation to your trained ML model."],insights:["Understand the model.","Explore the factors associated with predicted crop stress."]};$("#page-title").textContent=titles[id][0];$("#page-subtitle").textContent=titles[id][1]}
document.querySelectorAll(".nav").forEach(n=>n.addEventListener("click",()=>showPage(n.dataset.page)));
document.querySelectorAll("[data-go]").forEach(n=>n.addEventListener("click",()=>showPage(n.dataset.go)));
function renderClassBars(){const total=classCounts.reduce((a,x)=>a+x[1],0);$("#class-bars").innerHTML=classCounts.map(([name,count])=>`<div class="bar-row"><span>${name}</span><div class="bar-track"><div class="bar-fill" style="width:${count/total*100}%"></div></div><strong>${(count/total*100).toFixed(1)}%</strong></div>`).join("")}
async function api(path,opts={}){const r=await fetch(API_BASE+path,{...opts,headers:{"Content-Type":"application/json",...(opts.headers||{})}});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return r.json()}
async function checkApi(){try{await api("/api/health");$("#api-status").classList.add("online");$("#api-status").innerHTML="<i></i> API connected"}catch(e){$("#api-status").classList.remove("online");$("#api-status").innerHTML="<i></i> API not connected"}}
// ==========================================
// CROPWISE LIVE WEATHER
// ==========================================

let lastWeatherLocation = null;

// Convert weather codes into readable descriptions
function weatherDescription(code) {
    const conditions = {
        0: ["Clear sky", "☀️"],
        1: ["Mainly clear", "🌤️"],
        2: ["Partly cloudy", "⛅"],
        3: ["Overcast", "☁️"],
        45: ["Foggy", "🌫️"],
        48: ["Depositing rime fog", "🌫️"],
        51: ["Light drizzle", "🌦️"],
        53: ["Moderate drizzle", "🌦️"],
        55: ["Dense drizzle", "🌧️"],
        61: ["Slight rain", "🌧️"],
        63: ["Moderate rain", "🌧️"],
        65: ["Heavy rain", "🌧️"],
        71: ["Slight snowfall", "🌨️"],
        73: ["Moderate snowfall", "🌨️"],
        75: ["Heavy snowfall", "❄️"],
        80: ["Rain showers", "🌦️"],
        81: ["Moderate rain showers", "🌧️"],
        82: ["Heavy rain showers", "⛈️"],
        95: ["Thunderstorm", "⛈️"],
        96: ["Thunderstorm with hail", "⛈️"],
        99: ["Severe thunderstorm with hail", "⛈️"]
    };

    return conditions[code] || ["Weather unavailable", "🌤️"];
}

// Fetch weather using Open-Meteo
async function fetchFarmWeather(lat, lon, locationName) {
    const status = $("#weather-status");

    status.textContent = "Fetching latest weather information...";
    $("#weather-results").hidden = true;

    try {
        const url = new URL("https://api.open-meteo.com/v1/forecast");

        url.search = new URLSearchParams({
            latitude: lat,
            longitude: lon,

            current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",

            daily: "precipitation_sum,temperature_2m_max,temperature_2m_min",

            hourly: "precipitation_probability,precipitation,rain",

            forecast_hours: "24",
            forecast_days: "2",
            timezone: "auto"
    });

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Weather service unavailable");
        }

        const data = await response.json();

        displayFarmWeather(data, locationName);

        lastWeatherLocation = {
            lat,
            lon,
            name: locationName
        };

        status.textContent = "Weather information loaded successfully.";

    } catch (error) {
        status.textContent = "Unable to fetch weather. Please try again.";
        console.error("Weather error:", error);
        toast("Could not load weather information");
    }
}

// Display weather information
function displayFarmWeather(data, locationName) {
    const current = data.current;
    const daily = data.daily;

    const [description, icon] =
        weatherDescription(current.weather_code);

    $("#weather-location-label").textContent = locationName;
    $("#weather-temp").textContent =
        `${Math.round(current.temperature_2m)}°C`;

    $("#weather-condition").textContent = description;
    $("#weather-icon").textContent = icon;

    $("#weather-humidity").textContent =
        `${current.relative_humidity_2m}%`;

    $("#weather-wind").textContent =
        `${current.wind_speed_10m} km/h`;

    $("#weather-rain").textContent =
        `${current.precipitation} mm`;

    $("#weather-daily-rain").textContent =
        `${daily.precipitation_sum[0]} mm`;

    $("#weather-max").textContent =
        `${daily.temperature_2m_max[0]}°C`;

    $("#weather-min").textContent =
        `${daily.temperature_2m_min[0]}°C`;

    $("#weather-updated").textContent =
        `Updated: ${new Date().toLocaleTimeString("en-IN")}`;

    $("#weather-results").hidden = false;

    displayRainForecast(data);
}

// ==========================================
// NEXT 24 HOURS RAIN FORECAST
// ==========================================

function displayRainForecast(data) {

    const container = $("#rain-forecast-content");
    const hourly = data.hourly;

    if (!hourly || !hourly.time || !hourly.precipitation) {
        container.textContent = "Rain forecast is unavailable.";
        return;
    }

    const forecast = hourly.time.map((time, index) => ({
        time: time,
        probability: hourly.precipitation_probability?.[index] ?? 0,
        rain: hourly.precipitation[index] ?? 0
    }));

    const peakProbability = Math.max(
        ...forecast.map(x => x.probability)
    );

    const totalRainfall = forecast.reduce(
        (sum, x) => sum + x.rain,
        0
    );

    const rainHours = forecast.filter(
        x => x.probability >= 30 || x.rain > 0.1
    );

    let status;
    let icon;

    if (totalRainfall >= 1 || peakProbability >= 60) {
        status = "Rain is likely in the next 24 hours";
        icon = "🌧️";
    } else if (peakProbability >= 30 || totalRainfall > 0) {
        status = "Rain is possible in the next 24 hours";
        icon = "🌦️";
    } else {
        status = "Rain is unlikely in the next 24 hours";
        icon = "☀️";
    }

    const rainTimes = rainHours.length
        ? rainHours.slice(0, 8).map(x => {

            const time = x.time.substring(11, 16);

            return `
                <div class="rain-hour">
                    <span>${time}</span>
                    <strong>${x.probability}%</strong>
                    <small>${Number(x.rain).toFixed(1)} mm</small>
                </div>
            `;

        }).join("")
        : "<p>No significant rainfall is indicated.</p>";

    container.innerHTML = `
        <div class="rain-summary">

            <div class="rain-status">
                <span class="rain-icon">${icon}</span>

                <div>
                    <strong>${status}</strong>
                    <p>Hourly weather forecast for your selected location.</p>
                </div>
            </div>

            <div class="rain-stat-grid">

                <div class="rain-stat">
                    <span>Highest rain probability</span>
                    <strong>${peakProbability}%</strong>
                </div>

                <div class="rain-stat">
                    <span>Expected rainfall in 24 hours</span>
                    <strong>${totalRainfall.toFixed(1)} mm</strong>
                </div>

            </div>

            <h4>Hours with possible rainfall</h4>

            <div class="rain-hours">
                ${rainTimes}
            </div>

        </div>
    `;
}

// Use the farmer's current location
$("#use-location-btn").addEventListener("click", () => {

    if (!navigator.geolocation) {
        $("#weather-status").textContent =
            "Location services are not supported by this browser.";
        return;
    }

    $("#weather-status").textContent =
        "Getting your current location...";

    navigator.geolocation.getCurrentPosition(
        async position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            await fetchFarmWeather(
                lat,
                lon,
                "Your current location"
            );
        },

        error => {
            $("#weather-status").textContent =
                "Location access denied or unavailable. Please search manually.";
        },

        {
            enableHighAccuracy: true,
            timeout: 10000
        }
    );
});

// Search weather using a city or town name
// ==========================================
// SPELLING-TOLERANT LOCATION SEARCH
// ==========================================

// Calculate spelling difference between two words
function editDistance(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();

    const dp = Array.from(
        { length: a.length + 1 },
        () => Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;

            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }

    return dp[a.length][b.length];
}


// Search and display location suggestions
async function searchWeatherLocations(city) {

    const suggestions = $("#weather-suggestions");
    const status = $("#weather-status");

    suggestions.hidden = true;
    suggestions.innerHTML = "";

    status.textContent = "Searching for matching locations...";

    try {

        const url =
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Location search failed");
        }

        const result = await response.json();

        if (!result.results || result.results.length === 0) {

            status.textContent =
                "No matching locations found. Try another spelling.";

            return;
        }

        // Rank returned locations by spelling similarity
        const ranked = result.results
            .map(place => ({
                place,
                distance: editDistance(city, place.name)
            }))
            .sort((a, b) => a.distance - b.distance);

        suggestions.innerHTML = "";

        ranked.slice(0, 5).forEach(item => {

            const place = item.place;

            const locationName = [
                place.name,
                place.admin1,
                place.country
            ].filter(Boolean).join(", ");

            const button = document.createElement("button");

            button.type = "button";
            button.className = "weather-suggestion";

            const title = document.createElement("strong");
            title.textContent = place.name;

            const details = document.createElement("span");
            details.textContent = [
                place.admin1,
                place.country
            ].filter(Boolean).join(", ");

            button.append(title, details);

            button.addEventListener("click", async () => {

                $("#weather-city").value = place.name;

                suggestions.hidden = true;

                await fetchFarmWeather(
                    place.latitude,
                    place.longitude,
                    locationName
                );

            });

            suggestions.appendChild(button);

        });

        suggestions.hidden = false;

        status.textContent =
            "Select the correct location from the suggestions below.";

    } catch (error) {

        console.error("Location search error:", error);

        status.textContent =
            "Unable to search locations. Please try again.";

    }
}


// Handle manual location search
$("#weather-search-form").addEventListener("submit", async e => {

    e.preventDefault();

    const city = $("#weather-city").value.trim();

    if (city.length < 2) {
        toast("Please enter at least two characters.");
        return;
    }

    await searchWeatherLocations(city);

});
// Refresh weather for the previously selected location
$("#weather-refresh").addEventListener("click", () => {

    if (lastWeatherLocation) {
        fetchFarmWeather(
            lastWeatherLocation.lat,
            lastWeatherLocation.lon,
            lastWeatherLocation.name
        );
    }
});
// Load dashboard statistics from FastAPI
async function loadSummary() {
    try {
        const data = await api("/api/summary");

        // Update farm plot count
        $("#plot-count").textContent =
            Number(data.plots).toLocaleString("en-IN");

    } catch (error) {
        console.error("Could not load dashboard statistics:", error);
        $("#plot-count").textContent = "—";
    }
}
let allFields=[];
function renderFields(){const q=$("#field-search").value.toLowerCase(),risk=$("#risk-filter").value;const rows=allFields.filter(x=>(!risk||x.risk_category===risk)&&JSON.stringify(x).toLowerCase().includes(q));$("#field-count").textContent=`${rows.length} field(s)`;$("#field-table").innerHTML=rows.length?rows.map((x,i)=>`<tr><td><b>#${x.rank??i+1}</b></td><td><b>${escapeHtml(x.farm_id||x.Farm_ID||"—")}</b><span class="sub">${escapeHtml(x.plot_id||x.Plot_ID||"")}</span></td><td>${escapeHtml(x.crop_type||x.Crop_Type||"—")}<span class="sub">${escapeHtml(x.growth_stage||x.Crop_Growth_Stage||"")}</span></td><td><span class="risk-badge risk-${riskClass(x.risk_category)}">${escapeHtml(x.risk_category||"—")}</span></td><td class="score">${x.priority_score??"—"}</td><td>${escapeHtml(x.main_contributor||x.contributing_factors?.[0]?.feature||"—")}</td><td><button class="text-btn" onclick="inspectField('${escapeHtml(x.plot_id||x.Plot_ID||"")}')">View →</button></td></tr>`).join(""):`<tr><td colspan="7" class="empty">No field records found. Check your API response.</td></tr>`}
async function loadFields(){try{const data=await api("/api/fields");allFields=Array.isArray(data)?data:(data.fields||[]);allFields.sort((a,b)=>(b.priority_score??0)-(a.priority_score??0));renderFields()}catch(e){$("#field-table").innerHTML='<tr><td colspan="7" class="empty">Could not load fields. Confirm that GET /api/fields is implemented and CORS allows this frontend origin.</td></tr>';$("#field-count").textContent="API unavailable"}}
window.inspectField=(plot)=>{const f=allFields.find(x=>(x.plot_id||x.Plot_ID)===plot);if(!f)return;showPage("predict");toast("Selected field: "+plot)};
$("#field-search").addEventListener("input",renderFields);$("#risk-filter").addEventListener("change",renderFields);$("#reload-fields").addEventListener("click",loadFields);
$("#refresh-btn").addEventListener("click", () => {
    checkApi();
    loadSummary();
    loadFields();
    loadImportance();
});
function numericPayload(form){const fd=new FormData(form),out={};for(const [k,v] of fd.entries()){const el=form.elements[k];out[k]=el.type==="number"?Number(v):v}return out}
$("#predict-form").addEventListener("submit",async e=>{e.preventDefault();const btn=$("#predict-btn"),result=$("#prediction-result");btn.disabled=true;btn.textContent="Analysing…";result.innerHTML='<div class="result-placeholder"><div class="placeholder-icon">⌁</div><h3>Running model inference…</h3><p>Sending the observation to FastAPI.</p></div>';try{const data=await api("/api/predict",{method:"POST",body:JSON.stringify(numericPayload(e.target))});renderPrediction(data)}catch(err){result.innerHTML=`<div class="result-placeholder"><h3>Prediction unavailable</h3><p>${escapeHtml(err.message)}. Check the backend endpoint and browser console.</p></div>`;toast("Could not get prediction from API")}finally{btn.disabled=false;btn.innerHTML='Predict stress risk <span>→</span>'}});
function renderPrediction(d){const factors=d.contributing_factors||[];$("#prediction-result").innerHTML=`<div class="panel-head"><div><span class="tag">MODEL RESULT</span><h3 style="margin-top:12px">Predicted stress category</h3></div></div><div class="result-risk">${escapeHtml(d.risk_category||"Not returned")}</div><p>Model confidence: ${d.confidence!=null?(Number(d.confidence)*100).toFixed(1)+"%":"Not provided"}</p><div style="margin:20px 0 7px;color:#718078;font-size:10px">IRRIGATION PRIORITY SCORE</div><div class="result-score">${d.priority_score??"—"}<small style="font-size:11px;color:#8b978f"> / 100</small></div><p>${escapeHtml(d.priority_explanation||"Priority score and its criteria should be documented by the project team.")}</p><h3 style="font-size:12px;margin-top:24px">Contributing factors</h3>${factors.length?factors.map(f=>`<div class="factor"><b>${escapeHtml(f.feature||f.name||"Factor")}</b><span>${escapeHtml(f.value??f.impact??"")}</span></div>`).join(""):'<p>Backend did not return contributing factors.</p>'}<div class="notice">Use this estimate as decision support. Confirm field conditions before irrigation.</div>`}
async function loadImportance(){try{const data=await api("/api/feature-importance");const items=Array.isArray(data)?data:(data.features||[]);const max=Math.max(...items.map(x=>Number(x.importance)||0),.0001);$("#importance-list").innerHTML=items.slice(0,10).map(x=>`<div class="importance-item"><div class="importance-label"><b>${escapeHtml(x.feature||x.name)}</b><span>${Number(x.importance).toFixed(3)}</span></div><div class="importance-track"><div class="importance-fill" style="width:${Number(x.importance)/max*100}%"></div></div></div>`).join("")||'<div class="empty">No feature importance values returned.</div>'}catch(e){/* keep explanatory placeholder */}}
renderClassBars();checkApi();loadSummary();loadFields();loadImportance();