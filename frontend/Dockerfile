FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY proxy_params.inc /etc/nginx/conf.d/proxy_params.inc
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
