Project Setup Guide

This repository contains the source code for the application.

Live Preview

You can view the application here:

Open in vs code

Requirements

Make sure you have the following installed:

install express.js
npm
Installation

Follow these steps to run the project on your local machine.

1. Clone the repository

bash
git clone YOUR_REPOSITORY_URL


2. Open the project folder

bash
cd YOUR_PROJECT_FOLDER


3. Install dependencies

bash
npm install


4. Configure the API key

Create a .env.local file in the root directory and add your Gemini API key:

env
GEMINI_API_KEY=your_api_key_here


5. Start the development server

bash
npm run dev


The application will now be available at the local address shown in your terminal.

Notes
Keep your API key private.
Do not upload .env.local to GitHub.
Make sure .env.local is included in .gitignore.
