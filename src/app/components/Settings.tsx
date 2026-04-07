import { useState } from "react";
import { Settings as SettingsIcon, User, Bell, Shield, CreditCard, Sparkles, Check } from "lucide-react";

interface SettingsProps {
  userTier: "free" | "base" | "pro";
}

export function Settings({ userTier }: SettingsProps) {
  const [notifications, setNotifications] = useState({
    newRecipes: true,
    mealReminders: false,
    weeklyReport: true,
    creatorUpdates: true
  });

  const [dietary, setDietary] = useState<string[]>(["vegetarian"]);
  const [measurementSystem, setMeasurementSystem] = useState("metric");

  const tiers = [
    {
      name: "Free",
      price: "$0",
      features: [
        "10 saved recipes",
        "Basic nutrition tracking",
        "Recipe discovery",
        "Profile & macro calculator"
      ]
    },
    {
      name: "Base",
      price: "$4.99",
      period: "/month",
      features: [
        "Unlimited saved recipes",
        "AI meal planner",
        "Shopping list generator",
        "Recipe collections",
        "Advanced filters",
        "Priority support"
      ]
    },
    {
      name: "Pro",
      price: "$9.99",
      period: "/month",
      features: [
        "Everything in Base",
        "Recipe creation tools",
        "Progress tracking",
        "Meal prep mode",
        "Custom macro targets",
        "Export & share plans"
      ],
      badge: "Most Popular"
    }
  ];

  const getTierIndex = () => {
    if (userTier === "pro") return 2;
    if (userTier === "base") return 1;
    return 0;
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-800 dark:from-slate-700 dark:to-slate-900 rounded-xl">
            <SettingsIcon className="w-5 h-5 text-white" />
          </div>
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">Settings</h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400">Manage your account and preferences</p>
      </div>

      {/* Current Plan */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-violet-50/80 to-indigo-50/80 dark:from-violet-950/30 dark:to-indigo-950/30 border-2 border-violet-200/50 dark:border-violet-800/50 rounded-2xl p-6 mb-8 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <h3 className="text-slate-900 dark:text-white capitalize">{userTier} Plan</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {userTier === "free" && "Upgrade to unlock AI meal planning and unlimited recipes"}
              {userTier === "base" && "You have access to AI meal planning and unlimited recipes"}
              {userTier === "pro" && "You have full access to all premium features"}
            </p>
            {userTier !== "free" && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Next billing: April 15, 2026</p>
            )}
          </div>
          {userTier === "free" ? (
            <button className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 hover:scale-105 font-semibold">
              Upgrade
            </button>
          ) : (
            <button className="px-6 py-3 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-700 dark:text-slate-300">
              Manage Plan
            </button>
          )}
        </div>
      </div>

      {/* Account Section */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <User className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-slate-900 dark:text-white">Account</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input
              type="email"
              defaultValue="alex@example.com"
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Display Name</label>
            <input
              type="text"
              defaultValue="Alex Chen"
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
          <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-all text-sm font-medium">
            Change Password
          </button>
        </div>
      </div>

      {/* Preferences */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <SettingsIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-slate-900 dark:text-white">Preferences</h3>
        </div>
        <div className="space-y-6">
          <div>
            <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Measurement System</label>
            <div className="flex gap-3">
              <button
                onClick={() => setMeasurementSystem("metric")}
                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                  measurementSystem === "metric"
                    ? "border-violet-600 bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300"
                    : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
                }`}
              >
                Metric (g, kg, ml)
              </button>
              <button
                onClick={() => setMeasurementSystem("imperial")}
                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                  measurementSystem === "imperial"
                    ? "border-violet-600 bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300"
                    : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
                }`}
              >
                Imperial (oz, lb, cups)
              </button>
            </div>
          </div>
          <div>
            <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Dietary Restrictions</label>
            <div className="flex flex-wrap gap-2">
              {["vegetarian", "vegan", "gluten-free", "dairy-free", "keto", "paleo"].map((diet) => (
                <button
                  key={diet}
                  onClick={() => setDietary(prev => prev.includes(diet) ? prev.filter(d => d !== diet) : [...prev, diet])}
                  className={`px-4 py-2 rounded-lg border-2 transition-all capitalize ${
                    dietary.includes(diet)
                      ? "border-violet-600 bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300"
                      : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {diet}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-slate-900 dark:text-white">Notifications</h3>
        </div>
        <div className="space-y-4">
          {Object.entries(notifications).map(([key, value]) => (
            <label key={key} className="flex items-center justify-between cursor-pointer group">
              <span className="text-slate-700 dark:text-slate-300 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer-checked:bg-violet-600 transition-all peer-focus:ring-2 peer-focus:ring-violet-500/50"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-5"></div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Subscription Plans */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <CreditCard className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-slate-900 dark:text-white">All Plans</h3>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {tiers.map((tier, index) => (
            <div
              key={tier.name}
              className={`relative p-5 rounded-xl border-2 transition-all ${
                getTierIndex() === index
                  ? "border-violet-600 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 shadow-lg"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold rounded-full">
                  {tier.badge}
                </div>
              )}
              {getTierIndex() === index && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <h4 className="font-bold text-slate-900 dark:text-white mb-2">{tier.name}</h4>
              <div className="mb-4">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">{tier.price}</span>
                {tier.period && <span className="text-slate-500 dark:text-slate-400">{tier.period}</span>}
              </div>
              <ul className="space-y-2 mb-4">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
              {getTierIndex() !== index && (
                <button className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/30 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 rounded-lg transition-all font-medium">
                  {index > getTierIndex() ? "Upgrade" : "Current"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Privacy */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-slate-900 dark:text-white">Privacy & Security</h3>
        </div>
        <div className="space-y-3">
          <button className="w-full text-left px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-700 dark:text-slate-300">
            Download your data
          </button>
          <button className="w-full text-left px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-700 dark:text-slate-300">
            Privacy policy
          </button>
          <button className="w-full text-left px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-700 dark:text-slate-300">
            Terms of service
          </button>
          <button className="w-full text-left px-4 py-3 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30 rounded-lg transition-all text-red-600 dark:text-red-400">
            Delete account
          </button>
        </div>
      </div>
    </div>
  );
}
