/**
 * Suppr icon system — centralised icon map.
 *
 * Import from here instead of lucide-react directly.
 * This gives us a single place to swap icons or add
 * custom SVGs without touching every feature file.
 */
import {
  // Navigation
  Home,
  Compass,
  CalendarDays,
  BarChart3,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Menu,
  Search,
  Plus,
  Minus,
  Check,
  ArrowRight,
  ArrowLeft,
  ExternalLink,

  // Meals
  Coffee,
  Sun,
  UtensilsCrossed,
  Cookie,
  Apple,
  Flame,

  // Macros & nutrition
  Beef,
  Wheat,
  Droplets,
  Zap,
  Scale,
  Target,
  TrendingUp,
  TrendingDown,

  // Recipe & cooking
  BookOpen,
  Clock,
  Timer,
  ChefHat,
  CookingPot,
  Bookmark,
  BookmarkCheck,
  Share2,
  Heart,
  ThumbsUp,
  Star,

  // Import & social
  Link,
  Download,
  Upload,
  Globe,
  Instagram,
  Youtube,

  // Confidence & status
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Info,
  CircleCheck,
  CircleX,

  // Actions
  Pencil,
  Trash2,
  Copy,
  CopyPlus,
  MoreHorizontal,
  Filter,
  SlidersHorizontal,
  Camera,
  Mic,
  ScanBarcode,
  QrCode,
  RotateCcw,

  // Fitness
  Dumbbell,
  Footprints,
  HeartPulse,

  // Progress & data
  Trophy,
  Flame as Streak,
  CalendarCheck,
  PieChart,
  LineChart,
  Activity,
  Snowflake,

  // Misc
  Bell,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Moon,
  SunMedium,
  Sparkles,
  Crown,
  BadgeCheck,
  ShoppingCart,
  LogOut,
  Printer,
  Ticket,
  Shield,
  Monitor,
  LayoutGrid,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Semantic icon map — every icon used in Suppr */
export const Icons = {
  // Navigation
  home: Home,
  discover: Compass,
  plan: CalendarDays,
  progress: BarChart3,
  profile: User,
  settings: Settings,
  back: ChevronLeft,
  forward: ChevronRight,
  down: ChevronDown,
  up: ChevronUp,
  close: X,
  menu: Menu,
  search: Search,
  add: Plus,
  remove: Minus,
  check: Check,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  external: ExternalLink,

  // Meal types
  breakfast: Coffee,
  lunch: Sun,
  dinner: UtensilsCrossed,
  snack: Cookie,

  // Macros & nutrition
  calories: Flame,
  protein: Beef,
  carbs: Wheat,
  fat: Droplets,
  water: Droplets,
  food: Apple,
  scale: Scale,
  target: Target,
  trendUp: TrendingUp,
  trendDown: TrendingDown,
  energy: Zap,

  // Recipe & cooking
  recipe: BookOpen,
  time: Clock,
  timer: Timer,
  chef: ChefHat,
  cook: CookingPot,
  save: Bookmark,
  saved: BookmarkCheck,
  share: Share2,
  heart: Heart,
  like: ThumbsUp,
  star: Star,

  // Import & social
  link: Link,
  import: Download,
  upload: Upload,
  web: Globe,
  instagram: Instagram,
  youtube: Youtube,

  // Confidence & status
  verified: ShieldCheck,
  caution: ShieldAlert,
  alert: AlertCircle,
  info: Info,
  success: CircleCheck,
  error: CircleX,

  // Actions
  edit: Pencil,
  delete: Trash2,
  copy: Copy,
  copyPlus: CopyPlus,
  more: MoreHorizontal,
  filter: Filter,
  adjust: SlidersHorizontal,
  camera: Camera,
  mic: Mic,
  scan: ScanBarcode,
  qr: QrCode,
  refresh: RotateCcw,

  // Fitness
  dumbbell: Dumbbell,
  footprints: Footprints,
  heartPulse: HeartPulse,

  // Progress & data
  trophy: Trophy,
  streak: Streak,
  streakFreeze: Snowflake,
  calendarCheck: CalendarCheck,
  // 2026-04-20 — Progress-tab prototype port. Plain calendar glyph
  // (matches the `calendar-outline` Ionicon used on mobile).
  calendar: CalendarDays,
  pieChart: PieChart,
  lineChart: LineChart,
  activity: Activity,

  // Misc & navigation aliases
  shopping: ShoppingCart,
  user: User,
  create: ChefHat,
  logout: LogOut,
  sparkles: Sparkles,
  notifications: Bell,
  notification: Bell,
  printer: Printer,
  lock: Lock,
  unlock: Unlock,
  show: Eye,
  hide: EyeOff,
  darkMode: Moon,
  lightMode: SunMedium,
  sparkle: Sparkles,
  premium: Crown,
  badgeCheck: BadgeCheck,
  ticket: Ticket,
  shield: Shield,
  monitor: Monitor,
  layoutGrid: LayoutGrid,
  users: Users,
  household: Users,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof Icons;
export type { LucideIcon };
