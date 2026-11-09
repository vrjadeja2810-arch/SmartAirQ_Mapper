/**
 * Environmental Scoring & Advisory Engine
 * Implements the 1-10 Environmental Scoring Specification with Climate Modifiers
 */

export function calculateEnvironmentalScore(aqi, temp = 0.0, humidity = 0.0) {
  let baseScore = 10;
  let category = "Excellent";
  let color = "var(--score-10)";
  let aqiColorHex = "#10b981";

  // 1-10 Score Mapping based on AQI tiers
  if (aqi <= 25) {
    baseScore = 10;
    category = "Excellent";
    color = "var(--score-10)";
    aqiColorHex = "#10b981";
  } else if (aqi <= 50) {
    baseScore = aqi <= 38 ? 9 : 8;
    category = "Good";
    color = "var(--score-8-9)";
    aqiColorHex = "#22c55e";
  } else if (aqi <= 100) {
    if (aqi <= 68) baseScore = 7;
    else if (aqi <= 85) baseScore = 6;
    else baseScore = 5;
    category = "Moderate";
    color = "var(--score-5-7)";
    aqiColorHex = "#eab308";
  } else if (aqi <= 150) {
    baseScore = aqi <= 125 ? 4 : 3;
    category = "Unhealthy";
    color = "var(--score-3-4)";
    aqiColorHex = "#f97316";
  } else {
    baseScore = aqi <= 200 ? 2 : 1;
    category = "Hazardous";
    color = "var(--score-1-2)";
    aqiColorHex = "#ef4444";
  }

  // 3.3 Climate Modifier: If Temp > 35°C AND Humidity > 85%, penalty -1
  let penaltyApplied = false;
  let finalScore = baseScore;
  if (temp > 35.0 && humidity > 85.0) {
    finalScore = Math.max(1, baseScore - 1);
    penaltyApplied = true;
  }

  // Dynamic Health Advisory Copy
  const advisory = getAdvisoryForScore(finalScore);

  // Climate Comfort Calculation (simplified Steadman heat index approximation)
  const climateAssessment = assessClimateComfort(temp, humidity);

  return {
    score: finalScore,
    baseScore,
    category,
    color,
    aqiColorHex,
    penaltyApplied,
    advisoryTitle: advisory.title,
    advisoryText: advisory.text,
    advisoryLevel: advisory.level,
    climateAssessment
  };
}

function getAdvisoryForScore(score) {
  if (score >= 9) {
    return {
      level: "excellent",
      title: "Optimal Air Quality",
      text: "Air quality is considered satisfactory, and air pollution poses little or no risk. Ideal conditions for outdoor recreation and exercise."
    };
  } else if (score >= 7) {
    return {
      level: "good",
      title: "Good Air Conditions",
      text: "Air quality is acceptable. Very few sensitive individuals may experience minor irritation from prolonged outdoor exertion."
    };
  } else if (score >= 5) {
    return {
      level: "moderate",
      title: "Moderate Advisory",
      text: "Air quality is acceptable for most; however, people with respiratory conditions, asthma, or elderly individuals should limit prolonged outdoor exertion."
    };
  } else if (score >= 3) {
    return {
      level: "unhealthy",
      title: "Health Warning: Unhealthy",
      text: "Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects. Wear a protective mask and keep windows closed."
    };
  } else {
    return {
      level: "hazardous",
      title: "Hazardous Alert",
      text: "Health warnings of emergency conditions. The entire population is more likely to be affected. Avoid all outdoor exertion; operate air purifiers indoors."
    };
  }
}

function assessClimateComfort(temp, humidity) {
  // Simplified Heat Index calculation in Celsius
  let heatIndex = temp;
  if (temp >= 26.0 && humidity >= 40.0) {
    // Steadman formula approximation
    const c1 = -8.78469475556;
    const c2 = 1.61139411;
    const c3 = 2.33854883889;
    const c4 = -0.14611605;
    const c5 = -0.012308094;
    const c6 = -0.0164248277778;
    const c7 = 0.002211732;
    const c8 = 0.00072546;
    const c9 = -0.000003582;

    const hi = c1 + (c2 * temp) + (c3 * humidity) + (c4 * temp * humidity) +
      (c5 * temp * temp) + (c6 * humidity * humidity) +
      (c7 * temp * temp * humidity) + (c8 * temp * humidity * humidity) +
      (c9 * temp * temp * humidity * humidity);
    heatIndex = Math.round(hi * 10) / 10;
  }

  let label = "Comfortable";
  let percent = 30; // for the bar fill
  if (temp < 18) {
    label = "Cool";
    percent = 20;
  } else if (temp <= 27 && humidity <= 65) {
    label = "Comfortable";
    percent = 40;
  } else if (temp <= 32 || (temp <= 28 && humidity > 70)) {
    label = "Warm / Humid";
    percent = 65;
  } else if (temp <= 38 || heatIndex > 38) {
    label = "Extreme Caution";
    percent = 85;
  } else {
    label = "Danger / Severe Heat";
    percent = 100;
  }

  return {
    heatIndex,
    label,
    percent
  };
}
