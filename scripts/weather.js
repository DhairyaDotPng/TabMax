// TabMax - Weather Module using Open-Meteo API (free, no API key required)

export async function fetchWeather(city = 'New York', tempUnit = 'celsius', forceRefresh = false) {
  try {
    const cleanCity = city.trim();
    if (!cleanCity) return { error: 'Empty city name' };

    const cacheKey = `tabmax_weather_${cleanCity.toLowerCase()}_${tempUnit}`;
    if (!forceRefresh) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        // Cache valid for 20 minutes
        if (Date.now() - data.timestamp < 20 * 60 * 1000) {
          return data;
        }
      }
    }

    // 1. Geocoding lookup
    let searchTerm = cleanCity;
    let geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}&count=1&language=en&format=json`;
    let geoRes = await fetch(geoUrl);
    let geoData = await geoRes.json();

    // Fallback if user typed "City, Country"
    if ((!geoData.results || geoData.results.length === 0) && cleanCity.includes(',')) {
      searchTerm = cleanCity.split(',')[0].trim();
      geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}&count=1&language=en&format=json`;
      geoRes = await fetch(geoUrl);
      geoData = await geoRes.json();
    }

    if (!geoData.results || geoData.results.length === 0) {
      return { error: `Could not find "${cleanCity}"` };
    }

    const loc = geoData.results[0];
    const lat = loc.latitude;
    const lon = loc.longitude;
    const displayName = loc.name + (loc.country_code ? `, ${loc.country_code}` : '');

    // 2. Weather forecast lookup
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=${tempUnit}`;
    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json();

    if (!weatherData.current) {
      return { error: 'Weather data unavailable' };
    }

    const current = weatherData.current;
    const temp = Math.round(current.temperature_2m);
    const code = current.weather_code;
    const { condition, icon } = getWeatherInfo(code);

    const result = {
      temp,
      unit: tempUnit === 'celsius' ? '°C' : '°F',
      condition,
      icon,
      city: displayName,
      timestamp: Date.now()
    };

    localStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
  } catch (err) {
    console.warn('Weather fetch error:', err);
    return { error: 'Weather service offline' };
  }
}

function getWeatherInfo(code) {
  if (code === 0) return { condition: 'Clear', icon: '☀️' };
  if (code === 1 || code === 2) return { condition: 'Mainly Clear', icon: '🌤️' };
  if (code === 3) return { condition: 'Overcast', icon: '☁️' };
  if (code === 45 || code === 48) return { condition: 'Fog', icon: '🌫️' };
  if (code >= 51 && code <= 55) return { condition: 'Drizzle', icon: '🌦️' };
  if (code >= 61 && code <= 65) return { condition: 'Rain', icon: '🌧️' };
  if (code >= 71 && code <= 77) return { condition: 'Snow', icon: '🌨️' };
  if (code >= 80 && code <= 82) return { condition: 'Showers', icon: '🌧️' };
  if (code >= 95) return { condition: 'Thunderstorm', icon: '⛈️' };
  return { condition: 'Partly Cloudy', icon: '⛅' };
}
