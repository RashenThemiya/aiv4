FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=/backend
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# `npm run build` also builds the widget into dist/dist-widget/. Keep a copy at the
# old root path so existing embeds of /rag-chat-widget.iife.js keep working.
RUN npm run build && cp dist/dist-widget/rag-chat-widget.iife.js dist/

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
