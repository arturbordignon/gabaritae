# Gabaritae

Gabaritae é uma aplicação para simular provas do ENEM, permitindo que os usuários pratiquem questões de diferentes disciplinas e anos.

## Tecnologias Utilizadas

- **Backend:**

  - Node.js
  - Express
  - MongoDB (Mongoose)
  - Axios

## Documentação da API

A documentação da API é gerada automaticamente usando Swagger. Você pode acessar a documentação completa da API através do seguinte link:

[Gabaritae API Docs](https://gabaritae-backend.onrender.com/api-docs/)

## Instalação

### Pré-requisitos

- Node.js (versão 14 ou superior)
- MongoDB

### Passo a passo para executar este aplicativo em seu local

1. Clone o repositório:

```bash
git clone https://github.com/seu-usuario/gabaritae.git
cd gabaritae
```

2. Instale os pacotes do backend:

```
npm install
```

3. Configure as variáveis de ambiente:

Crie um arquivo .env na raiz do projeto e adicione as seguintes variáveis:

```
MONGO_URI=mongodb://localhost:27017/gabaritae
JWT_SECRET=xxxxx
EMAIL_USERNAME=seu-email-google@gmail.com
EMAIL_PASSWORD=sua-senha-google
PORT=4500
```

4. Rodar o backend:

```
npm run dev
```
