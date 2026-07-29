FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /build
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre-jammy

WORKDIR /app
RUN useradd --system --uid 10001 --create-home dts \
    && mkdir -p /data/config /data/uploads \
    && chown -R dts:dts /data

COPY --from=build /build/target/dts-backend-*.jar /app/dts-backend.jar
COPY --chown=dts:dts src/main/resources/dts-customization.yml /data/config/dts-customization.yml

USER dts
EXPOSE 8080

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=65.0", "-jar", "/app/dts-backend.jar"]
