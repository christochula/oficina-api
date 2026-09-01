{{- define "oficina-api.name" -}}
oficina-api
{{- end }}

{{- define "oficina-api.labels" -}}
app.kubernetes.io/name: {{ include "oficina-api.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
tags.datadoghq.com/env: {{ .Values.environment | quote }}
tags.datadoghq.com/service: {{ .Values.config.ddService | quote }}
tags.datadoghq.com/version: {{ .Values.config.ddVersion | quote }}
{{- end }}

