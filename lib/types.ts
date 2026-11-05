// Tipos de las tablas de la base de datos (ver supabase/migrations).

export type TipoCuenta = "debito" | "credito" | "efectivo" | "ahorro";
export type TipoMovimiento = "gasto" | "ingreso";
export type Frecuencia = "semanal" | "catorcenal" | "quincenal" | "mensual" | "anual" | "unica";

export interface Account {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  dia_corte: number | null;
  dia_limite_pago: number | null;
  saldo_actual: number;
  ultimos_4: string | null;
  es_demo: boolean;
}

export interface Category {
  id: string;
  nombre: string;
  presupuesto_mensual: number;
  color_neutro: string;
  es_demo: boolean;
}

export interface Transaction {
  id: string;
  account_id: string | null;
  fecha: string;
  descripcion_original: string;
  comercio: string | null;
  monto: number;
  tipo: TipoMovimiento;
  category_id: string | null;
  requiere_revision: boolean;
  es_recurrente: boolean;
  confianza: number | null;
  hash_unico: string;
  import_id: string | null;
}

export interface Rule {
  id: string;
  patron_texto: string;
  category_id: string;
  veces_aplicada: number;
}

export interface SavingsGoal {
  id: string;
  nombre: string;
  monto_objetivo: number;
  monto_actual: number;
  fecha_objetivo: string;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  fecha: string;
  monto: number;
  nota: string | null;
}

export interface ScheduledPayment {
  id: string;
  nombre: string;
  monto: number;
  frecuencia: Frecuencia;
  proximo_vencimiento: string;
  account_id: string | null;
  tipo: TipoMovimiento;
  category_id: string | null;
  registrar_automatico: boolean;
}

export interface ImportRow {
  id: string;
  nombre_archivo: string;
  ruta_storage: string | null;
  estado: "pendiente" | "procesado" | "confirmado" | "error";
  movimientos_detectados: number;
  created_at: string;
}

/** Movimiento en la vista previa, antes de guardarse. */
export interface DraftTransaction {
  key: string; // identificador temporal en el navegador
  fecha: string; // YYYY-MM-DD
  descripcion_original: string;
  comercio: string | null;
  monto: number; // siempre positivo
  tipo: TipoMovimiento;
  account_id: string | null;
  category_id: string | null;
  confianza: number | null;
  origen_categoria: "regla" | "ia" | "manual" | null;
  requiere_revision: boolean;
  hash_unico: string;
  duplicado: boolean;
  incluir: boolean;
}
