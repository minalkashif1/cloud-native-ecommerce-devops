# ShopCloud - Cloud Native Microservices DevOps Project

A cloud-native e-commerce platform built with Docker, Kubernetes, Jenkins, and GitHub Actions CI/CD.

## Team Members
- Minal - Home Page, User Service Page
- Minahil - Products Page, Orders Page, Notifications Page

## Project Structure

cloud-native-ecommerce-devops/
├── .github/workflows/    # CI/CD GitHub Actions
├── k8s/                  # Kubernetes manifests
├── src/frontend/         # Static website pages
├── Dockerfile            # Container definition
├── Jenkinsfile           # Jenkins pipeline
└── README.md

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Containerization: Docker
- Orchestration: Kubernetes
- CI/CD: GitHub Actions + Jenkins
- Deployment: Render.com

## How to Run Locally

### With Docker
```bash
docker build -t ecommerce-frontend:latest .
docker run -p 8080:80 ecommerce-frontend:latest
```
Open http://localhost:8080

## CI/CD Pipeline
- **CI**: Runs on every push — lints HTML/CSS, builds Docker image
- **CD**: Deploys to Render.com on push to develop/staging/main

## Kubernetes Deployment
```bash
kubectl apply -f k8s/frontend-deployment.yaml
```

## Environments
| Branch | Environment |
|--------|-------------|
| develop | Development |
| staging | Staging |
| main | Production |

## Reflection
This project gave us hands-on experience with containerized deployments and CI/CD automation. 
We learned how GitHub Actions, Docker, and Kubernetes work together in a real DevOps workflow. 
The biggest challenge was managing secrets across environments and debugging Docker build issues. 
Overall it strengthened our understanding of cloud-native application delivery.