#!/usr/bin/env bash
set -euo pipefail

EKS_MODULE_FILE=".terraform/modules/eks/main.tf"

if [[ ! -f "$EKS_MODULE_FILE" ]]; then
  echo "Arquivo $EKS_MODULE_FILE nao encontrado. Rode 'terraform init' antes deste script."
  exit 1
fi

# Se ja estiver patchado, nao faz nada.
if grep -q "Talent Lab hotfix" "$EKS_MODULE_FILE"; then
  echo "Patch Talent Lab ja aplicado em $EKS_MODULE_FILE"
  exit 0
fi

# Remove bloco do data source que exige iam:GetRole na role voclabs.
perl -0777 -i -pe 's/data "aws_iam_session_context" "current" \{.*?\}\n\n//s' "$EKS_MODULE_FILE"

# Substitui issuer_arn por arn do caller STS, evitando consulta IAM bloqueada no lab.
perl -i -pe 's/data\.aws_iam_session_context\.current\.issuer_arn/data.aws_caller_identity.current.arn/g' "$EKS_MODULE_FILE"

# Marca visual de patch aplicado.
perl -i -pe 'if ($. == 3) { print "\n## Talent Lab hotfix:\n## evita iam:GetRole na role voclabs (explicit deny)\n" }' "$EKS_MODULE_FILE"

echo "Patch Talent Lab aplicado com sucesso em $EKS_MODULE_FILE"