// E2E semua app web Interstellar (warehouse, backoffice, content-management, merchant + lintas app).
// Jalan tiap malam + manual lewat "Build with Parameters". Pola sama dengan everest-e2e.
//
// Prasyarat (sekali, admin Jenkins):
// - Credential "Username with password" id `interstellar-e2e-qa` = akun QA automation (akses semua app).
// - Credential "Username with password" id `interstellar-e2e-imap` = inbox email akun QA (baca OTP), password = App Password Gmail.
//   Credential yang belum ada bikin SELURUH build gagal sebelum stage apa pun jalan: buat dulu, baru merge
//   Jenkinsfile yang memakainya.
// - Agent Jenkins harus bisa `docker run`. Kalau controller jalan di container dengan volume docker
//   `jenkins-data` (seperti Jenkins Everest), workspace di-mount lewat volume-subpath. Kalau Jenkins jalan
//   langsung di host, ganti baris --mount dengan: -v "$WORKSPACE":/work
// - Versi image di PW_IMAGE harus sama dengan @playwright/test di package.json.
pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 60, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '30'))
  }

  triggers {
    cron('TZ=Asia/Jakarta\nH 1 * * *')
  }

  parameters {
    choice(name: 'APP', choices: ['semua', 'warehouse', 'backoffice', 'content-management', 'merchant', 'technician', 'lintas-app', 'invoice'],
      description: 'App yang dites. "semua" = semua project. Login + OTP app itu otomatis ikut jalan duluan.')
    string(name: 'BASE_HOST', defaultValue: 'https://interstellar.kalachakra.io', description: 'Host Interstellar yang dites (tanpa path app). Jangan production.')
    string(name: 'GREP', defaultValue: '', description: 'Opsional: cuma jalanin test yang judulnya cocok (contoh: TC-WH-INV atau TC-BO-TIC-001)')
  }

  environment {
    PW_IMAGE = 'mcr.microsoft.com/playwright:v1.63.0-noble'
    E2E = credentials('interstellar-e2e-qa')
    IMAP = credentials('interstellar-e2e-imap')
    E2E_IMAP_HOST = 'imap.gmail.com'   // inbox akun QA (Gmail, login IMAP pakai App Password)
    E2E_IMAP_PORT = '993'
  }

  stages {
    stage('E2E') {
      steps {
        sh '''
          if [ "$APP" = "semua" ]; then PROJECT=""; else PROJECT="--project=$APP"; fi
          E2E_EMAIL="$E2E_USR" E2E_PASSWORD="$E2E_PSW" E2E_IMAP_USER="$IMAP_USR" E2E_IMAP_PASSWORD="$IMAP_PSW" \
          docker run --rm --ipc=host \
            --mount type=volume,src=jenkins-data,dst=/work,volume-subpath="${WORKSPACE#/var/jenkins_home/}" \
            -w /work -u "$(id -u):$(id -g)" \
            -e HOME=/tmp/home -e CI=true \
            -e BASE_HOST -e GREP -e PROJECT -e E2E_EMAIL -e E2E_PASSWORD \
            -e E2E_IMAP_HOST -e E2E_IMAP_PORT -e E2E_IMAP_USER -e E2E_IMAP_PASSWORD \
            "$PW_IMAGE" \
            sh -c 'npm ci --no-audit --no-fund && npx playwright test $PROJECT ${GREP:+--grep "$GREP"}'
        '''
      }
    }
  }

  post {
    always {
      junit allowEmptyResults: true, testResults: 'results/junit.xml'
      archiveArtifacts artifacts: 'playwright-report/**, test-results/**', allowEmptyArchive: true
    }
  }
}
