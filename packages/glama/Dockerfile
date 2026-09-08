# Paste this Dockerfile into Glama's server configuration.
# Uses the released wheel, including its renderer; no repository build needed.
FROM python:3.13-slim
RUN pip install --no-cache-dir "3d-visualizer[mcp]==0.4.2" \
    && useradd --create-home --uid 10001 viewer \
    && mkdir /data \
    && chown viewer:viewer /data
USER viewer
WORKDIR /data
CMD ["3d-visualizer-mcp", "--root", "/data"]
