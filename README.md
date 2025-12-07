# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Stripe (for payments)

## Stripe Payment Setup

To enable payment processing:

1. **Get your Stripe keys:**
   - Sign up at https://stripe.com
   - Go to Developers > API keys
   - Copy your Publishable key

2. **Set environment variable:**
   - Create a `.env` file in the root directory
   - Add: `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here`

3. **Backend Setup (Required for production):**
   - You need to create a backend endpoint at `/api/create-payment-intent`
   - This endpoint should:
     - Create a Stripe PaymentIntent
     - Return the `clientSecret` to the frontend
   - Example backend code (Node.js/Express):
     ```javascript
     const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
     
     app.post('/api/create-payment-intent', async (req, res) => {
       const { amount, currency = 'eur' } = req.body;
       
       const paymentIntent = await stripe.paymentIntents.create({
         amount: Math.round(amount * 100), // Convert to cents
         currency,
       });
       
       res.json({ clientSecret: paymentIntent.client_secret });
     });
     ```

4. **Start the backend server:**
   - Open a new terminal window
   - Run: `npm run server`
   - The server will start on http://localhost:3001
   - Make sure your Stripe secret key is set (it's already configured in server.js)

5. **Start the frontend:**
   - In another terminal, run: `npm run dev`
   - The frontend will run on http://localhost:8080 (or the port shown)

**Note:** Both the backend server and frontend need to be running for payments to work!

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
