FROM node:20-alpine AS build

WORKDIR /app

COPY package.json yarn.lock ./

RUN corepack enable && yarn install --frozen-lockfile

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN yarn build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]