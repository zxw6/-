<!-- 顶图参考 Uiverse.io by andrew-demchenk0 -->
<template>
  <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <rect fill="#ffffff" width="540" height="450" />
    <defs>
      <linearGradient
        id="profile-card-grad"
        gradientUnits="userSpaceOnUse"
        x1="0"
        x2="0"
        y1="0"
        y2="100%"
        gradientTransform="rotate(222,648,379)"
      >
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="1" stop-color="#FC726E" />
      </linearGradient>
      <pattern
        id="profile-card-pattern"
        patternUnits="userSpaceOnUse"
        width="300"
        height="250"
        viewBox="0 0 1080 900"
      >
        <g fill-opacity="0.5">
          <polygon fill="#444" points="90 150 0 300 180 300" />
          <polygon points="90 150 180 0 0 0" />
          <polygon fill="#AAA" points="270 150 360 0 180 0" />
          <polygon fill="#DDD" points="450 150 360 300 540 300" />
          <polygon fill="#999" points="450 150 540 0 360 0" />
          <polygon points="630 150 540 300 720 300" />
          <polygon fill="#DDD" points="630 150 720 0 540 0" />
          <polygon fill="#444" points="810 150 720 300 900 300" />
          <polygon fill="#FFF" points="810 150 900 0 720 0" />
          <polygon fill="#DDD" points="990 150 900 300 1080 300" />
          <polygon fill="#444" points="990 150 1080 0 900 0" />
        </g>
      </pattern>
    </defs>
    <rect x="0" y="0" fill="url(#profile-card-grad)" width="100%" height="100%" />
    <rect x="0" y="0" fill="url(#profile-card-pattern)" width="100%" height="100%" />
  </svg>
</template>