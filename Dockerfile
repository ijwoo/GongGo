# 공고함 web (Next.js). 백엔드 주소는 실행 시 API_BASE_URL로 넘긴다
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile
COPY . .
# 지도 스타일 URL은 브라우저 번들에 들어가므로 빌드 시점에 정한다
ARG NEXT_PUBLIC_MAP_STYLE_URL=
ENV NEXT_PUBLIC_MAP_STYLE_URL=$NEXT_PUBLIC_MAP_STYLE_URL
RUN pnpm build

FROM node:22-alpine
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["pnpm", "start", "--port", "3000"]
